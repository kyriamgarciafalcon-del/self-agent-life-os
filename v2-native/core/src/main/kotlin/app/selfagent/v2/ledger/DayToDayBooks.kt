package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import app.selfagent.v2.money.Money
import app.selfagent.v2.money.MoneyException

class DayToDayBooks(private val posts: PostJournal, val record: RecordExpense) {
    constructor(posts: PostJournal, books: LedgerBooks) : this(posts, RecordExpense(posts, books))

    fun transfer(commandId: String, amount: String, from: String, to: String) {
        val money = parsePositive(amount)
        posts.execute(
            JournalCommand(
                commandId = commandId,
                journalId = "j-$commandId",
                postings = listOf(
                    PostingInput("from-$commandId", from, signedMinor = -money.minor, currency = money.currency),
                    PostingInput("to-$commandId", to, signedMinor = money.minor, currency = money.currency),
                ),
            ),
        )
    }

    fun pad(commandId: String, personal: String, receivable: String) {
        record.books.ensureCashAndExpenseAccounts()
        if (record.books.balance("receivable", Currency.CNY) == 0L) {
            runCatching { record.books.createLedgerAccount("receivable", Currency.CNY, AccountRole.RECEIVABLE) }
        }
        val personalMoney = parsePositive(personal)
        val claim = parsePositive(receivable)
        val cashOut = personalMoney.minor + claim.minor
        posts.execute(
            JournalCommand(
                commandId = commandId,
                journalId = "j-$commandId",
                postings = listOf(
                    PostingInput("e-$commandId", "expense", signedMinor = personalMoney.minor, currency = Currency.CNY),
                    PostingInput("r-$commandId", "receivable", signedMinor = claim.minor, currency = Currency.CNY),
                    PostingInput("c-$commandId", "cash", signedMinor = -cashOut, currency = Currency.CNY),
                ),
            ),
        )
    }

    fun collect(commandId: String, amount: String) {
        val money = parsePositive(amount)
        val outstanding = record.books.balance("receivable", money.currency)
        if (money.minor > outstanding) throw LedgerException(LedgerError.OVER_SETTLE)
        posts.execute(
            JournalCommand(
                commandId = commandId,
                journalId = "j-$commandId",
                postings = listOf(
                    PostingInput("in-$commandId", "cash", signedMinor = money.minor, currency = money.currency),
                    PostingInput("out-$commandId", "receivable", signedMinor = -money.minor, currency = money.currency),
                ),
            ),
        )
    }

    fun reverseLast() {
        val originalId = record.books.lastOriginalJournalId() ?: throw LedgerException(LedgerError.INVALID)
        val reverseCommand = "rev-$originalId"
        if (record.books.receiptFor(reverseCommand) != null) {
            throw LedgerException(LedgerError.ALREADY_REVERSED)
        }
        val original = record.books.postingsOf(originalId)
        if (original.isEmpty()) throw LedgerException(LedgerError.FOREIGN_KEY)
        posts.execute(
            JournalCommand(
                commandId = reverseCommand,
                journalId = "j-$reverseCommand",
                postings = original.mapIndexed { index, posting ->
                    PostingInput(
                        id = "r$index-$reverseCommand",
                        ledgerAccountId = posting.ledgerAccountId,
                        signedMinor = Math.negateExact(posting.signedMinor),
                        currency = posting.currency,
                    )
                },
            ),
        )
    }

    fun cardSpend(commandId: String, amount: String) {
        val money = parsePositive(amount)
        posts.execute(
            JournalCommand(
                commandId = commandId,
                journalId = "j-$commandId",
                postings = listOf(
                    PostingInput("e-$commandId", "expense", signedMinor = money.minor, currency = money.currency),
                    PostingInput("p-$commandId", "card", signedMinor = -money.minor, currency = money.currency),
                ),
            ),
        )
    }

    fun cardPay(commandId: String, amount: String) {
        val money = parsePositive(amount)
        posts.execute(
            JournalCommand(
                commandId = commandId,
                journalId = "j-$commandId",
                postings = listOf(
                    PostingInput("cash-$commandId", "cash", signedMinor = -money.minor, currency = money.currency),
                    PostingInput("card-$commandId", "card", signedMinor = money.minor, currency = money.currency),
                ),
            ),
        )
    }

    private fun parsePositive(amount: String) = try {
        val money = Money.parse(amount.trim())
        if (money.minor <= 0) throw LedgerException(LedgerError.INVALID)
        money
    } catch (_: MoneyException) {
        throw LedgerException(LedgerError.INVALID)
    }
}
