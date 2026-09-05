package app.selfagent.v2

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import app.selfagent.v2.ledger.AccountRole
import app.selfagent.v2.ledger.CommandReceipt
import app.selfagent.v2.ledger.JournalDraft
import app.selfagent.v2.ledger.LedgerBooks
import app.selfagent.v2.ledger.LedgerError
import app.selfagent.v2.ledger.LedgerException
import app.selfagent.v2.money.Currency

class AndroidLedgerBooks(context: Context) : LedgerBooks {
    private val db: SQLiteDatabase = Helper(context).writableDatabase.also {
        it.execSQL("PRAGMA foreign_keys = ON")
    }

    override fun ensureCashAndExpenseAccounts() {
        if (!accountExists("cash")) createLedgerAccount("cash", Currency.CNY, AccountRole.CASH)
        if (!accountExists("expense")) createLedgerAccount("expense", Currency.CNY, AccountRole.EXPENSE)
    }

    override fun createLedgerAccount(id: String, currency: Currency, role: AccountRole) {
        db.execSQL(
            "INSERT INTO ledger_account(id, currency, role) VALUES (?, ?, ?)",
            arrayOf(id, currency.name, role.name),
        )
    }

    override fun journalCount(): Int =
        db.rawQuery("SELECT COUNT(*) FROM journal_entry", null).use { rows ->
            rows.moveToFirst()
            rows.getInt(0)
        }

    override fun balance(ledgerAccountId: String, currency: Currency): Long =
        db.rawQuery(
            "SELECT COALESCE(SUM(signed_minor), 0) FROM posting WHERE ledger_account_id = ? AND currency = ?",
            arrayOf(ledgerAccountId, currency.name),
        ).use { rows ->
            rows.moveToFirst()
            rows.getLong(0)
        }

    override fun recentExpenseMinors(): List<Long> {
        val items = mutableListOf<Long>()
        db.rawQuery(
            """
            SELECT p.signed_minor FROM posting p
            JOIN ledger_account a ON a.id = p.ledger_account_id
            WHERE a.role = ? ORDER BY p.rowid DESC
            """.trimIndent(),
            arrayOf(AccountRole.EXPENSE.name),
        ).use { rows ->
            while (rows.moveToNext()) items += rows.getLong(0)
        }
        return items
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
        if (exists("SELECT 1 FROM journal_entry WHERE id = ?", draft.id) ||
            exists("SELECT 1 FROM journal_entry WHERE command_id = ?", draft.commandId)
        ) {
            throw LedgerException(LedgerError.DUPLICATE_ID)
        }
        db.beginTransaction()
        try {
            db.execSQL(
                "INSERT INTO journal_entry(id, command_id, payload_hash) VALUES (?, ?, ?)",
                arrayOf(draft.id, draft.commandId, draft.payloadHash),
            )
            for (posting in draft.postings) {
                val accountCurrency = accountCurrency(posting.ledgerAccountId)
                if (accountCurrency != posting.currency) throw LedgerException(LedgerError.INVALID)
                db.execSQL(
                    "INSERT INTO posting(id, journal_id, ledger_account_id, signed_minor, currency) VALUES (?, ?, ?, ?, ?)",
                    arrayOf(
                        posting.id,
                        posting.journalId,
                        posting.ledgerAccountId,
                        posting.signedMinor.toString(),
                        posting.currency.name,
                    ),
                )
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    override fun receiptFor(commandId: String): CommandReceipt? =
        db.rawQuery(
            "SELECT command_id, id, payload_hash FROM journal_entry WHERE command_id = ?",
            arrayOf(commandId),
        ).use { rows ->
            if (!rows.moveToFirst()) null
            else CommandReceipt(rows.getString(0), rows.getString(1), rows.getString(2), "committed")
        }

    override fun sumByRoles(currency: Currency, roles: Set<AccountRole>): Long {
        if (roles.isEmpty()) return 0
        val placeholders = roles.joinToString(",") { "?" }
        val args = arrayOf(currency.name) + roles.map { it.name }.toTypedArray()
        return db.rawQuery(
            """
            SELECT COALESCE(SUM(p.signed_minor), 0)
            FROM posting p
            JOIN ledger_account a ON a.id = p.ledger_account_id
            WHERE p.currency = ? AND a.role IN ($placeholders)
            """.trimIndent(),
            args,
        ).use { rows ->
            rows.moveToFirst()
            rows.getLong(0)
        }
    }

    private fun accountExists(id: String): Boolean = exists("SELECT 1 FROM ledger_account WHERE id = ?", id)

    private fun accountCurrency(id: String): Currency =
        db.rawQuery("SELECT currency FROM ledger_account WHERE id = ?", arrayOf(id)).use { rows ->
            if (!rows.moveToFirst()) throw LedgerException(LedgerError.FOREIGN_KEY)
            Currency.parse(rows.getString(0))
        }

    private fun exists(sql: String, arg: String): Boolean =
        db.rawQuery(sql, arrayOf(arg)).use { it.moveToFirst() }

    private class Helper(context: Context) : SQLiteOpenHelper(context, "v2-ledger.sqlite", null, 1) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL("PRAGMA foreign_keys = ON")
            db.execSQL(
                """
                CREATE TABLE ledger_account (
                  id TEXT PRIMARY KEY,
                  currency TEXT NOT NULL,
                  role TEXT NOT NULL DEFAULT 'OTHER'
                )
                """.trimIndent(),
            )
            db.execSQL(
                """
                CREATE TABLE journal_entry (
                  id TEXT PRIMARY KEY,
                  command_id TEXT NOT NULL UNIQUE,
                  payload_hash TEXT NOT NULL DEFAULT '',
                  reverses_id TEXT,
                  reason TEXT
                )
                """.trimIndent(),
            )
            db.execSQL(
                """
                CREATE TABLE posting (
                  id TEXT PRIMARY KEY,
                  journal_id TEXT NOT NULL REFERENCES journal_entry(id),
                  ledger_account_id TEXT NOT NULL REFERENCES ledger_account(id),
                  signed_minor INTEGER NOT NULL,
                  currency TEXT NOT NULL
                )
                """.trimIndent(),
            )
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    }
}
