package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardCopyOption
import java.sql.Connection
import java.sql.DriverManager

enum class LedgerError { FOREIGN_KEY, UNBALANCED, DUPLICATE_ID, INVALID }

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
)

class LedgerStore private constructor(private val path: Path, private var connection: Connection) {
    fun createLedgerAccount(id: String, currency: Currency) {
        connection.prepareStatement("INSERT INTO ledger_account(id, currency) VALUES (?, ?)").use { statement ->
            statement.setString(1, id)
            statement.setString(2, currency.name)
            statement.executeUpdate()
        }
    }

    fun commitJournal(draft: JournalDraft) {
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
            connection.prepareStatement("INSERT INTO journal_entry(id, command_id) VALUES (?, ?)").use { statement ->
                statement.setString(1, draft.id)
                statement.setString(2, draft.commandId)
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

    fun journalCount(): Int =
        connection.createStatement().use { statement ->
            statement.executeQuery("SELECT COUNT(*) FROM journal_entry").use { rows ->
                rows.next()
                rows.getInt(1)
            }
        }

    fun balance(ledgerAccountId: String, currency: Currency): Long =
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
                      currency TEXT NOT NULL
                    )
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    CREATE TABLE IF NOT EXISTS journal_entry (
                      id TEXT PRIMARY KEY,
                      command_id TEXT NOT NULL UNIQUE
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
            }
            return connection
        }
    }
}
