package app.selfagent.v2.inbox

import app.selfagent.v2.ledger.LedgerError
import app.selfagent.v2.ledger.LedgerException
import app.selfagent.v2.ledger.RecordExpense
import java.nio.file.Files
import java.nio.file.Path
import java.sql.Connection
import java.sql.DriverManager

data class InboxDraft(
    val id: String,
    val amount: String,
    val version: Int,
)

data class InboxItem(
    val id: String,
    val amount: String,
    val version: Int,
    val status: String,
)

class InboxService private constructor(val record: RecordExpense, private val connection: Connection) {
    fun offer(draft: InboxDraft) {
        val existing = get(draft.id)
        if (existing != null && existing.status != "pending") return
        connection.prepareStatement(
            "INSERT INTO inbox_item(id, amount, version, status) VALUES (?, ?, ?, 'pending') ON CONFLICT(id) DO UPDATE SET amount=excluded.amount, version=excluded.version WHERE inbox_item.status='pending'",
        ).use { statement ->
            statement.setString(1, draft.id)
            statement.setString(2, draft.amount)
            statement.setInt(3, draft.version)
            statement.executeUpdate()
        }
    }

    fun pending(): List<InboxItem> {
        val items = mutableListOf<InboxItem>()
        connection.prepareStatement(
            "SELECT id, amount, version, status FROM inbox_item WHERE status = 'pending' ORDER BY rowid",
        ).use { statement ->
            statement.executeQuery().use { rows ->
                while (rows.next()) {
                    items += InboxItem(rows.getString(1), rows.getString(2), rows.getInt(3), rows.getString(4))
                }
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
        setStatus(id, "confirmed")
    }

    fun ignore(id: String, expectedVersion: Int) {
        val item = get(id) ?: return
        if (item.status != "pending") return
        if (item.version != expectedVersion) throw LedgerException(LedgerError.COMMAND_CONFLICT)
        setStatus(id, "ignored")
    }

    private fun get(id: String): InboxItem? =
        connection.prepareStatement(
            "SELECT id, amount, version, status FROM inbox_item WHERE id = ?",
        ).use { statement ->
            statement.setString(1, id)
            statement.executeQuery().use { rows ->
                if (!rows.next()) null
                else InboxItem(rows.getString(1), rows.getString(2), rows.getInt(3), rows.getString(4))
            }
        }

    private fun setStatus(id: String, status: String) {
        connection.prepareStatement("UPDATE inbox_item SET status = ? WHERE id = ?").use { statement ->
            statement.setString(1, status)
            statement.setString(2, id)
            statement.executeUpdate()
        }
    }

    companion object {
        fun open(path: Path, record: RecordExpense): InboxService {
            Files.createDirectories(path.parent)
            val connection = DriverManager.getConnection("jdbc:sqlite:${path.toAbsolutePath()}")
            connection.createStatement().use { statement ->
                statement.execute(
                    """
                    CREATE TABLE IF NOT EXISTS inbox_item (
                      id TEXT PRIMARY KEY,
                      amount TEXT NOT NULL,
                      version INTEGER NOT NULL,
                      status TEXT NOT NULL
                    )
                    """.trimIndent(),
                )
            }
            return InboxService(record, connection)
        }
    }
}
