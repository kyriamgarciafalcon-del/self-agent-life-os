package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import app.selfagent.v2.money.Money
import java.security.MessageDigest

data class PostingInput(
    val id: String,
    val ledgerAccountId: String,
    val amount: String? = null,
    val signedMinor: Long? = null,
    val currency: Currency? = null,
)

data class JournalCommand(
    val commandId: String,
    val journalId: String,
    val schemaVersion: Int = 1,
    val postings: List<PostingInput>,
)

data class CommandReceipt(
    val commandId: String,
    val journalId: String,
    val payloadHash: String,
    val status: String,
)

class PostJournal(val store: LedgerStore) {
    fun execute(command: JournalCommand): CommandReceipt {
        if (command.commandId.isBlank() || command.journalId.isBlank() || command.postings.isEmpty()) {
            throw LedgerException(LedgerError.INVALID)
        }
        val hash = payloadHash(command)
        val existing = store.receiptFor(command.commandId)
        if (existing != null) {
            if (existing.payloadHash != hash) throw LedgerException(LedgerError.COMMAND_CONFLICT)
            return existing
        }
        val drafts = command.postings.map { input ->
            val currency = input.currency ?: Currency.CNY
            val minor = when {
                input.signedMinor != null && input.amount != null -> throw LedgerException(LedgerError.INVALID)
                input.signedMinor != null -> input.signedMinor
                input.amount != null -> Money.parse(input.amount, currency).minor
                else -> throw LedgerException(LedgerError.INVALID)
            }
            if (minor == 0L) throw LedgerException(LedgerError.INVALID)
            PostingDraft(input.id, command.journalId, input.ledgerAccountId, minor, currency)
        }
        store.commitJournal(
            JournalDraft(
                id = command.journalId,
                commandId = command.commandId,
                postings = drafts,
                payloadHash = hash,
            ),
        )
        return CommandReceipt(command.commandId, command.journalId, hash, "committed")
    }

    private fun payloadHash(command: JournalCommand): String {
        val canonical = buildString {
            append(command.commandId)
            append('\n')
            append(command.journalId)
            append('\n')
            append(command.schemaVersion)
            append('\n')
            command.postings.forEach { posting ->
                append(posting.id)
                append('|')
                append(posting.ledgerAccountId)
                append('|')
                append(posting.amount ?: "")
                append('|')
                append(posting.signedMinor ?: "")
                append('|')
                append(posting.currency?.name ?: "")
                append('\n')
            }
        }
        return MessageDigest.getInstance("SHA-256")
            .digest(canonical.toByteArray(Charsets.UTF_8))
            .joinToString("") { byte -> "%02x".format(byte) }
    }
}
