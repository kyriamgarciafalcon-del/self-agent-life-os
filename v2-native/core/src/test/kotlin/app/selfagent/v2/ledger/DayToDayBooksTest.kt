package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path

class DayToDayBooksTest {
    @TempDir
    lateinit var dir: Path

    private fun ops(): DayToDayBooks {
        val store = LedgerStore.open(dir.resolve("ledger.sqlite"))
        store.ensureCashAndExpenseAccounts()
        return DayToDayBooks(PostJournal(store), store)
    }

    @Test
    fun `same currency transfer does not change net worth`() {
        val books = ops()
        books.record.execute("seed", "100.00")
        val before = LedgerQueries(books.record.books).netWorth(Currency.CNY)
        books.transfer(commandId = "t1", amount = "40.00", from = "cash", to = "wechat")
        assertEquals(before, LedgerQueries(books.record.books).netWorth(Currency.CNY))
        assertEquals(-14000L, books.record.books.balance("cash", Currency.CNY))
        assertEquals(4000L, books.record.books.balance("wechat", Currency.CNY))
        assertEquals(10000L, LedgerQueries(books.record.books).personalConsumption(Currency.CNY))
    }

    @Test
    fun `pad splits personal and receivable then partial collect`() {
        val books = ops()
        books.pad(commandId = "pad", personal = "100.00", receivable = "200.00")
        assertEquals(10000L, LedgerQueries(books.record.books).personalConsumption(Currency.CNY))
        assertEquals(-30000L, books.record.books.balance("cash", Currency.CNY))
        assertEquals(20000L, books.record.books.balance("receivable", Currency.CNY))
        books.collect(commandId = "c1", amount = "120.00")
        assertEquals(8000L, books.record.books.balance("receivable", Currency.CNY))
        assertEquals(-18000L, books.record.books.balance("cash", Currency.CNY))
        assertEquals(10000L, LedgerQueries(books.record.books).personalConsumption(Currency.CNY))
        assertEquals(
            LedgerError.OVER_SETTLE,
            assertThrows(LedgerException::class.java) { books.collect("c2", "90.00") }.code,
        )
    }
}
