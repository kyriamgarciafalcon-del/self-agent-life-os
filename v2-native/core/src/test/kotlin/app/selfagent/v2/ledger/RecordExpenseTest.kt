package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path

class RecordExpenseTest {
    @TempDir
    lateinit var dir: Path

    private fun books(): RecordExpense {
        val store = LedgerStore.open(dir.resolve("ledger.sqlite"))
        store.ensureCashAndExpenseAccounts()
        return RecordExpense(PostJournal(store), store)
    }

    @Test
    fun `blank amount does not write a journal`() {
        val record = books()
        assertEquals(
            LedgerError.INVALID,
            assertThrows(LedgerException::class.java) {
                record.execute(commandId = "c1", amount = "  ")
            }.code,
        )
        assertEquals(0, record.books.journalCount())
    }

    @Test
    fun `posts thirty yuan as CNY and query layer matches`() {
        val record = books()
        record.execute(commandId = "lunch", amount = "30")
        assertEquals(3000L, record.books.balance("expense", Currency.CNY))
        assertEquals(-3000L, record.books.balance("cash", Currency.CNY))
        assertEquals(3000L, LedgerQueries(record.books).personalConsumption(Currency.CNY))
        assertEquals(listOf(3000L), record.books.recentExpenseMinors())
    }

    @Test
    fun `same commandId does not post twice`() {
        val record = books()
        record.execute(commandId = "tap", amount = "30.00")
        record.execute(commandId = "tap", amount = "30.00")
        assertEquals(1, record.books.journalCount())
        assertEquals(3000L, LedgerQueries(record.books).personalConsumption(Currency.CNY))
    }
}
