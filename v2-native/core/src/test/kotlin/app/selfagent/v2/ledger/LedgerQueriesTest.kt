package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path

class LedgerQueriesTest {
    @TempDir
    lateinit var dir: Path

    @Test
    fun `consumption cashflow and net worth share one query layer`() {
        val store = LedgerStore.open(dir.resolve("ledger.sqlite"))
        store.createLedgerAccount("cash", Currency.CNY, AccountRole.CASH)
        store.createLedgerAccount("expense", Currency.CNY, AccountRole.EXPENSE)
        store.createLedgerAccount("income", Currency.CNY, AccountRole.INCOME)
        PostJournal(store).execute(
            JournalCommand(
                commandId = "wage",
                journalId = "j-in",
                postings = listOf(
                    PostingInput("i1", "cash", amount = "8000.00"),
                    PostingInput("i2", "income", amount = "-8000.00"),
                ),
            ),
        )
        PostJournal(store).execute(
            JournalCommand(
                commandId = "lunch",
                journalId = "j-out",
                postings = listOf(
                    PostingInput("e1", "expense", amount = "30.00"),
                    PostingInput("e2", "cash", amount = "-30.00"),
                ),
            ),
        )
        val q = LedgerQueries(store)
        assertEquals(3000L, q.personalConsumption(Currency.CNY))
        assertEquals(797000L, q.cashFlow(Currency.CNY))
        assertEquals(797000L, q.netWorth(Currency.CNY))
        assertEquals(797000L, q.balance("cash", Currency.CNY))
    }
}
