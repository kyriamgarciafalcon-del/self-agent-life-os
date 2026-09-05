package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import app.selfagent.v2.money.Money

enum class AccountRole { CASH, EXPENSE, INCOME, RECEIVABLE, PAYABLE, OTHER }

data class ReverseCommand(
    val commandId: String,
    val journalId: String,
    val originalJournalId: String,
    val reason: String,
)

class ReverseJournal(private val store: LedgerStore) {
    fun execute(command: ReverseCommand): CommandReceipt {
        if (command.reason.isBlank()) throw LedgerException(LedgerError.INVALID)
        val existing = store.receiptFor(command.commandId)
        if (existing != null) return existing
        if (store.reversalOf(command.originalJournalId) != null) {
            throw LedgerException(LedgerError.ALREADY_REVERSED)
        }
        val original = store.postingsOf(command.originalJournalId)
        if (original.isEmpty()) throw LedgerException(LedgerError.FOREIGN_KEY)
        val posts = PostJournal(store)
        return posts.execute(
            JournalCommand(
                commandId = command.commandId,
                journalId = command.journalId,
                postings = original.mapIndexed { index, posting ->
                    PostingInput(
                        id = "${command.journalId}-r$index",
                        ledgerAccountId = posting.ledgerAccountId,
                        signedMinor = Math.negateExact(posting.signedMinor),
                        currency = posting.currency,
                    )
                },
            ),
        ).also {
            store.markReversal(command.journalId, command.originalJournalId, command.reason)
        }
    }
}

data class ClaimDraft(val id: String, val originJournalId: String, val amount: String, val currency: Currency = Currency.CNY)

data class SettleDraft(
    val commandId: String,
    val journalId: String,
    val claimId: String,
    val cashAccountId: String,
    val amount: String,
)

class ClaimService(private val store: LedgerStore) {
    fun open(draft: ClaimDraft) {
        val minor = Money.parse(draft.amount, draft.currency).minor
        if (minor <= 0) throw LedgerException(LedgerError.INVALID)
        val receivable = store.postingsOf(draft.originJournalId)
            .firstOrNull { store.accountRole(it.ledgerAccountId) == AccountRole.RECEIVABLE }
            ?: throw LedgerException(LedgerError.FOREIGN_KEY)
        store.insertClaim(draft.id, draft.originJournalId, receivable.ledgerAccountId, minor, draft.currency)
    }

    fun outstanding(claimId: String): Long = store.claimOutstanding(claimId)

    fun settle(draft: SettleDraft) {
        val claim = store.claim(draft.claimId)
        val amount = Money.parse(draft.amount, claim.currency).minor
        if (amount <= 0) throw LedgerException(LedgerError.INVALID)
        if (amount > claim.outstanding) throw LedgerException(LedgerError.OVER_SETTLE)
        PostJournal(store).execute(
            JournalCommand(
                commandId = draft.commandId,
                journalId = draft.journalId,
                postings = listOf(
                    PostingInput("c-${draft.journalId}", draft.cashAccountId, signedMinor = amount, currency = claim.currency),
                    PostingInput("r-${draft.journalId}", claim.receivableAccountId, signedMinor = -amount, currency = claim.currency),
                ),
            ),
        )
        store.insertAllocation(draft.claimId, draft.journalId, amount)
    }
}

data class ClaimRecord(
    val id: String,
    val receivableAccountId: String,
    val currency: Currency,
    val confirmedMinor: Long,
    val outstanding: Long,
)

class LedgerQueries(private val store: LedgerBooks) {
    fun personalConsumption(currency: Currency): Long = store.sumByRoles(currency, setOf(AccountRole.EXPENSE))
    fun cashFlow(currency: Currency): Long = store.sumByRoles(currency, setOf(AccountRole.CASH))
    fun netWorth(currency: Currency): Long =
        store.sumByRoles(currency, setOf(AccountRole.CASH, AccountRole.RECEIVABLE, AccountRole.PAYABLE))
    fun balance(ledgerAccountId: String, currency: Currency): Long = store.balance(ledgerAccountId, currency)
}
