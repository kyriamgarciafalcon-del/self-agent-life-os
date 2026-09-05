package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import app.selfagent.v2.money.Money
import app.selfagent.v2.money.MoneyException

interface LedgerBooks {
    fun ensureCashAndExpenseAccounts()
    fun createLedgerAccount(id: String, currency: Currency = Currency.CNY, role: AccountRole = AccountRole.OTHER)
    fun journalCount(): Int
    fun balance(ledgerAccountId: String, currency: Currency): Long
    fun recentExpenseMinors(): List<Long>
    fun commitJournal(draft: JournalDraft)
    fun receiptFor(commandId: String): CommandReceipt?
    fun sumByRoles(currency: Currency, roles: Set<AccountRole>): Long
}

class RecordExpense(private val posts: PostJournal, val books: LedgerBooks) {
    fun execute(commandId: String, amount: String) {
        val trimmed = amount.trim()
        if (trimmed.isEmpty()) throw LedgerException(LedgerError.INVALID)
        val money = try {
            Money.parse(trimmed)
        } catch (_: MoneyException) {
            throw LedgerException(LedgerError.INVALID)
        }
        if (money.minor <= 0) throw LedgerException(LedgerError.INVALID)
        posts.execute(
            JournalCommand(
                commandId = commandId,
                journalId = "j-$commandId",
                postings = listOf(
                    PostingInput("e-$commandId", "expense", signedMinor = money.minor, currency = money.currency),
                    PostingInput("c-$commandId", "cash", signedMinor = -money.minor, currency = money.currency),
                ),
            ),
        )
    }
}
