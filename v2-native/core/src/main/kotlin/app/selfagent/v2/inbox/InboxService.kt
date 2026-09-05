package app.selfagent.v2.inbox

import app.selfagent.v2.ledger.LedgerError
import app.selfagent.v2.ledger.LedgerException
import app.selfagent.v2.ledger.RecordExpense

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

class InboxService(val record: RecordExpense) {
    private val items = linkedMapOf<String, InboxItem>()

    fun offer(draft: InboxDraft) {
        val existing = items[draft.id]
        if (existing != null && existing.status != "pending") return
        items[draft.id] = InboxItem(draft.id, draft.amount, draft.version, "pending")
    }

    fun pending(): List<InboxItem> = items.values.filter { it.status == "pending" }

    fun confirm(id: String, expectedVersion: Int) {
        val item = items[id] ?: return
        if (item.status == "confirmed") return
        if (item.status != "pending" || item.version != expectedVersion) {
            throw LedgerException(LedgerError.COMMAND_CONFLICT)
        }
        record.execute(commandId = "inbox-$id", amount = item.amount)
        items[id] = item.copy(status = "confirmed")
    }

    fun ignore(id: String, expectedVersion: Int) {
        val item = items[id] ?: return
        if (item.status != "pending") return
        if (item.version != expectedVersion) throw LedgerException(LedgerError.COMMAND_CONFLICT)
        items[id] = item.copy(status = "ignored")
    }
}
