package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.sql.Connection
import java.sql.DriverManager

enum class LedgerError { FOREIGN_KEY, UNBALANCED, DUPLICATE_ID, INVALID, COMMAND_CONFLICT, ALREADY_REVERSED, OVER_SETTLE }

class LedgerException(val code: LedgerError) : IllegalArgumentException(code.name)

data class PostingDraft(
    val id: String,
    val journalId: String,
    val ledgerAccountId: String,
    val signedMinor: Long,
    val currency: Currency,
)

data class JournalDraft(
    val id: String,
    val commandId: String,
    val postings: List<PostingDraft>,
    val payloadHash: String = "",
)

class LedgerStore private constructor(private val path: Path, private var connection: Connection) : LedgerBooks {
    override fun createLedgerAccount(id: String, currency: Currency, role: AccountRole) {
        connection.prepareStatement("INSERT INTO ledger_account(id, currency, role) VALUES (?, ?, ?)").use { statement ->
            statement.setString(1, id)
            statement.setString(2, currency.name)
            statement.setString(3, role.name)
            statement.executeUpdate()
        }
    }

    override fun ensureCashAndExpenseAccounts() {
        if (!accountExists("cash")) createLedgerAccount("cash", Currency.CNY, AccountRole.CASH)
        if (!accountExists("expense")) createLedgerAccount("expense", Currency.CNY, AccountRole.EXPENSE)
        if (!accountExists("wechat")) createLedgerAccount("wechat", Currency.CNY, AccountRole.CASH)
        if (!accountExists("receivable")) createLedgerAccount("receivable", Currency.CNY, AccountRole.RECEIVABLE)
    }

    override fun recentExpenseMinors(): List<Long> =
        connection.prepareStatement(
            """
            SELECT p.signed_minor FROM posting p
            JOIN ledger_account a ON a.id = p.ledger_account_id
            WHERE a.role = ? ORDER BY p.rowid DESC
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, AccountRole.EXPENSE.name)
            statement.executeQuery().use { rows ->
                val items = mutableListOf<Long>()
                while (rows.next()) items += rows.getLong(1)
                items
            }
        }

    override fun commitJournal(draft: JournalDraft) {
        if (draft.id.isBlank() || draft.commandId.isBlank() || draft.postings.isEmpty()) {
            throw LedgerException(LedgerError.INVALID)
        }
        if (draft.postings.any { it.journalId != draft.id || !accountExists(it.ledgerAccountId) }) {
            throw LedgerException(LedgerError.FOREIGN_KEY)
        }
        if (draft.postings.groupBy { it.currency }.values.any { group -> group.sumOf { it.signedMinor } != 0L }) {
            throw LedgerException(LedgerError.UNBALANCED)
        }
        if (journalExists(draft.id) || commandExists(draft.commandId)) {
            throw LedgerException(LedgerError.DUPLICATE_ID)
        }
        connection.autoCommit = false
        try {
            connection.prepareStatement("INSERT INTO journal_entry(id, command_id, payload_hash) VALUES (?, ?, ?)").use { statement ->
                statement.setString(1, draft.id)
                statement.setString(2, draft.commandId)
                statement.setString(3, draft.payloadHash)
                statement.executeUpdate()
            }
            connection.prepareStatement(
                "INSERT INTO posting(id, journal_id, ledger_account_id, signed_minor, currency) VALUES (?, ?, ?, ?, ?)",
            ).use { statement ->
                for (posting in draft.postings) {
                    val accountCurrency = accountCurrency(posting.ledgerAccountId)
                    if (accountCurrency != posting.currency) throw LedgerException(LedgerError.INVALID)
                    statement.setString(1, posting.id)
                    statement.setString(2, posting.journalId)
                    statement.setString(3, posting.ledgerAccountId)
                    statement.setLong(4, posting.signedMinor)
                    statement.setString(5, posting.currency.name)
                    statement.addBatch()
                }
                statement.executeBatch()
            }
            connection.commit()
        } catch (error: LedgerException) {
            connection.rollback()
            throw error
        } catch (_: Exception) {
            connection.rollback()
            throw LedgerException(LedgerError.INVALID)
        } finally {
            connection.autoCommit = true
        }
    }

    override fun journalCount(): Int =
        connection.createStatement().use { statement ->
            statement.executeQuery("SELECT COUNT(*) FROM journal_entry").use { rows ->
                rows.next()
                rows.getInt(1)
            }
        }

    override fun balance(ledgerAccountId: String, currency: Currency): Long =
        connection.prepareStatement(
            "SELECT COALESCE(SUM(signed_minor), 0) FROM posting WHERE ledger_account_id = ? AND currency = ?",
        ).use { statement ->
            statement.setString(1, ledgerAccountId)
            statement.setString(2, currency.name)
            statement.executeQuery().use { rows ->
                rows.next()
                rows.getLong(1)
            }
        }

    fun postingsOf(journalId: String): List<PostingDraft> =
        connection.prepareStatement(
            "SELECT id, journal_id, ledger_account_id, signed_minor, currency FROM posting WHERE journal_id = ?",
        ).use { statement ->
            statement.setString(1, journalId)
            statement.executeQuery().use { rows ->
                val items = mutableListOf<PostingDraft>()
                while (rows.next()) {
                    items += PostingDraft(
                        id = rows.getString(1),
                        journalId = rows.getString(2),
                        ledgerAccountId = rows.getString(3),
                        signedMinor = rows.getLong(4),
                        currency = Currency.parse(rows.getString(5)),
                    )
                }
                items
            }
        }

    fun accountRole(id: String): AccountRole =
        connection.prepareStatement("SELECT role FROM ledger_account WHERE id = ?").use { statement ->
            statement.setString(1, id)
            statement.executeQuery().use { rows ->
                if (!rows.next()) throw LedgerException(LedgerError.FOREIGN_KEY)
                AccountRole.valueOf(rows.getString(1))
            }
        }

    fun markReversal(journalId: String, originalJournalId: String, reason: String) {
        connection.prepareStatement("UPDATE journal_entry SET reverses_id = ?, reason = ? WHERE id = ?").use { statement ->
            statement.setString(1, originalJournalId)
            statement.setString(2, reason)
            statement.setString(3, journalId)
            statement.executeUpdate()
        }
    }

    fun reversalOf(originalJournalId: String): String? =
        connection.prepareStatement("SELECT id FROM journal_entry WHERE reverses_id = ?").use { statement ->
            statement.setString(1, originalJournalId)
            statement.executeQuery().use { rows -> if (rows.next()) rows.getString(1) else null }
        }

    fun insertClaim(id: String, originJournalId: String, receivableAccountId: String, confirmedMinor: Long, currency: Currency) {
        connection.prepareStatement(
            "INSERT INTO claim(id, origin_journal_id, receivable_account_id, confirmed_minor, currency) VALUES (?, ?, ?, ?, ?)",
        ).use { statement ->
            statement.setString(1, id)
            statement.setString(2, originJournalId)
            statement.setString(3, receivableAccountId)
            statement.setLong(4, confirmedMinor)
            statement.setString(5, currency.name)
            statement.executeUpdate()
        }
    }

    fun claim(id: String): ClaimRecord {
        val confirmed = connection.prepareStatement(
            "SELECT receivable_account_id, confirmed_minor, currency FROM claim WHERE id = ?",
        ).use { statement ->
            statement.setString(1, id)
            statement.executeQuery().use { rows ->
                if (!rows.next()) throw LedgerException(LedgerError.FOREIGN_KEY)
                Triple(rows.getString(1), rows.getLong(2), Currency.parse(rows.getString(3)))
            }
        }
        return ClaimRecord(id, confirmed.first, confirmed.third, confirmed.second, claimOutstanding(id))
    }

    fun claimOutstanding(id: String): Long {
        val confirmed = connection.prepareStatement("SELECT confirmed_minor FROM claim WHERE id = ?").use { statement ->
            statement.setString(1, id)
            statement.executeQuery().use { rows ->
                if (!rows.next()) throw LedgerException(LedgerError.FOREIGN_KEY)
                rows.getLong(1)
            }
        }
        val allocated = connection.prepareStatement(
            "SELECT COALESCE(SUM(amount_minor), 0) FROM settlement_allocation WHERE claim_id = ?",
        ).use { statement ->
            statement.setString(1, id)
            statement.executeQuery().use { rows ->
                rows.next()
                rows.getLong(1)
            }
        }
        return confirmed - allocated
    }

    fun insertAllocation(claimId: String, journalId: String, amountMinor: Long) {
        connection.prepareStatement(
            "INSERT INTO settlement_allocation(claim_id, journal_id, amount_minor) VALUES (?, ?, ?)",
        ).use { statement ->
            statement.setString(1, claimId)
            statement.setString(2, journalId)
            statement.setLong(3, amountMinor)
            statement.executeUpdate()
        }
    }

    override fun sumByRoles(currency: Currency, roles: Set<AccountRole>): Long {
        if (roles.isEmpty()) return 0
        val placeholders = roles.joinToString(",") { "?" }
        return connection.prepareStatement(
            """
            SELECT COALESCE(SUM(p.signed_minor), 0)
            FROM posting p
            JOIN ledger_account a ON a.id = p.ledger_account_id
            WHERE p.currency = ? AND a.role IN ($placeholders)
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, currency.name)
            roles.forEachIndexed { index, role -> statement.setString(index + 2, role.name) }
            statement.executeQuery().use { rows ->
                rows.next()
                rows.getLong(1)
            }
        }
    }

    fun backupTo(target: Path) {
        val escaped = target.toAbsolutePath().toString().replace("'", "''")
        connection.createStatement().use { it.executeUpdate("VACUUM INTO '$escaped'") }
    }

    fun restoreFrom(source: Path) {
        connection.close()
        Files.copy(source, path, StandardCopyOption.REPLACE_EXISTING)
        connection = connect(path)
    }

    private fun accountExists(id: String): Boolean =
        connection.prepareStatement("SELECT 1 FROM ledger_account WHERE id = ?").use { statement ->
            statement.setString(1, id)
            statement.executeQuery().use { it.next() }
        }

    private fun accountCurrency(id: String): Currency =
        connection.prepareStatement("SELECT currency FROM ledger_account WHERE id = ?").use { statement ->
            statement.setString(1, id)
            statement.executeQuery().use { rows ->
                if (!rows.next()) throw LedgerException(LedgerError.FOREIGN_KEY)
                Currency.parse(rows.getString(1))
            }
        }

    override fun receiptFor(commandId: String): CommandReceipt? =
        connection.prepareStatement(
            "SELECT command_id, id, payload_hash FROM journal_entry WHERE command_id = ?",
        ).use { statement ->
            statement.setString(1, commandId)
            statement.executeQuery().use { rows ->
                if (!rows.next()) null
                else CommandReceipt(
                    commandId = rows.getString(1),
                    journalId = rows.getString(2),
                    payloadHash = rows.getString(3),
                    status = "committed",
                )
            }
        }

    private fun journalExists(id: String): Boolean =
        connection.prepareStatement("SELECT 1 FROM journal_entry WHERE id = ?").use { statement ->
            statement.setString(1, id)
            statement.executeQuery().use { it.next() }
        }

    private fun commandExists(id: String): Boolean =
        connection.prepareStatement("SELECT 1 FROM journal_entry WHERE command_id = ?").use { statement ->
            statement.setString(1, id)
            statement.executeQuery().use { it.next() }
        }

    companion object {
        fun open(path: Path): LedgerStore = LedgerStore(path, connect(path))

        private fun connect(path: Path): Connection {
            Files.createDirectories(path.parent)
            val connection = DriverManager.getConnection("jdbc:sqlite:${path.toAbsolutePath()}")
            connection.createStatement().use { statement ->
                statement.execute("PRAGMA foreign_keys = ON")
                statement.execute(
                    """
                    CREATE TABLE IF NOT EXISTS ledger_account (
                      id TEXT PRIMARY KEY,
                      currency TEXT NOT NULL,
                      role TEXT NOT NULL DEFAULT 'OTHER'
                    )
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    CREATE TABLE IF NOT EXISTS journal_entry (
                      id TEXT PRIMARY KEY,
                      command_id TEXT NOT NULL UNIQUE,
                      payload_hash TEXT NOT NULL DEFAULT '',
                      reverses_id TEXT,
                      reason TEXT
                    )
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    CREATE TABLE IF NOT EXISTS posting (
                      id TEXT PRIMARY KEY,
                      journal_id TEXT NOT NULL REFERENCES journal_entry(id),
                      ledger_account_id TEXT NOT NULL REFERENCES ledger_account(id),
                      signed_minor INTEGER NOT NULL,
                      currency TEXT NOT NULL
                    )
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    CREATE TABLE IF NOT EXISTS claim (
                      id TEXT PRIMARY KEY,
                      origin_journal_id TEXT NOT NULL,
                      receivable_account_id TEXT NOT NULL,
                      confirmed_minor INTEGER NOT NULL,
                      currency TEXT NOT NULL
                    )
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    CREATE TABLE IF NOT EXISTS settlement_allocation (
                      claim_id TEXT NOT NULL REFERENCES claim(id),
                      journal_id TEXT NOT NULL,
                      amount_minor INTEGER NOT NULL
                    )
                    """.trimIndent(),
                )
            }
            return connection
        }
    }
}
