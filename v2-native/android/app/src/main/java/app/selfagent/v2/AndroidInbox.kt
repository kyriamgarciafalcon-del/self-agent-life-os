package app.selfagent.v2

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import app.selfagent.v2.inbox.InboxDraft
import app.selfagent.v2.inbox.InboxItem
import app.selfagent.v2.ledger.LedgerError
import app.selfagent.v2.ledger.LedgerException
import app.selfagent.v2.ledger.RecordExpense

class AndroidInbox(context: Context, private val record: RecordExpense) {
    private val db: SQLiteDatabase = Helper(context).writableDatabase

    fun offer(draft: InboxDraft) {
        val existing = get(draft.id)
        if (existing != null && existing.status != "pending") return
        if (existing == null) {
            db.execSQL(
                "INSERT INTO inbox_item(id, amount, version, status) VALUES (?, ?, ?, 'pending')",
                arrayOf(draft.id, draft.amount, draft.version.toString()),
            )
        } else {
            db.execSQL(
                "UPDATE inbox_item SET amount = ?, version = ? WHERE id = ? AND status = 'pending'",
                arrayOf(draft.amount, draft.version.toString(), draft.id),
            )
        }
    }

    fun pending(): List<InboxItem> {
        val items = mutableListOf<InboxItem>()
        db.rawQuery(
            "SELECT id, amount, version, status FROM inbox_item WHERE status = 'pending' ORDER BY rowid",
            null,
        ).use { rows ->
            while (rows.moveToNext()) {
                items += InboxItem(rows.getString(0), rows.getString(1), rows.getInt(2), rows.getString(3))
            }
        }
        return items
    }

    fun confirm(id: String, expectedVersion: Int) {
        val item = get(id) ?: return
        if (item.status == "confirmed") return
        if (item.status != "pending" || item.version != expectedVersion) {
            throw LedgerException(LedgerError.COMMAND_CONFLICT)
        }
        record.execute(commandId = "inbox-$id", amount = item.amount)
        db.execSQL("UPDATE inbox_item SET status = 'confirmed' WHERE id = ?", arrayOf(id))
    }

    fun ignore(id: String, expectedVersion: Int) {
        val item = get(id) ?: return
        if (item.status != "pending") return
        if (item.version != expectedVersion) throw LedgerException(LedgerError.COMMAND_CONFLICT)
        db.execSQL("UPDATE inbox_item SET status = 'ignored' WHERE id = ?", arrayOf(id))
    }

    private fun get(id: String): InboxItem? =
        db.rawQuery(
            "SELECT id, amount, version, status FROM inbox_item WHERE id = ?",
            arrayOf(id),
        ).use { rows ->
            if (!rows.moveToFirst()) null
            else InboxItem(rows.getString(0), rows.getString(1), rows.getInt(2), rows.getString(3))
        }

    private class Helper(context: Context) : SQLiteOpenHelper(context, "v2-inbox.sqlite", null, 1) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE inbox_item (
                  id TEXT PRIMARY KEY,
                  amount TEXT NOT NULL,
                  version INTEGER NOT NULL,
                  status TEXT NOT NULL
                )
                """.trimIndent(),
            )
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    }
}
