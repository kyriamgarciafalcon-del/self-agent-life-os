package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path

class ReverseAndCardTest {
    @TempDir
    lateinit var dir: Path

    private fun ops(): DayToDayBooks {
        val store = LedgerStore.open(dir.resolve("ledger.sqlite"))
        store.ensureCashAndExpenseAccounts()
        return DayToDayBooks(PostJournal(store), store)
    }

    @Test
    fun `reverse last expense keeps original and zeros consumption`() {
        val books = ops()
        books.record.execute("lunch", "30.00")
        books.reverseLast()
        assertEquals(2, books.record.books.journalCount())
        assertEquals(0L, LedgerQueries(books.record.books).personalConsumption(Currency.CNY))
        assertEquals(0L, books.record.books.balance("cash", Currency.CNY))
        assertEquals(
            LedgerError.ALREADY_REVERSED,
            assertThrows(LedgerException::class.java) { books.reverseLast() }.code,
        )
    }

    @Test
    fun `card spend counts once repayment is not consumption`() {
        val books = ops()
        books.cardSpend("cs1", "30.00")
        assertEquals(3000L, LedgerQueries(books.record.books).personalConsumption(Currency.CNY))
        assertEquals(-3000L, books.record.books.balance("card", Currency.CNY))
        books.cardPay("cp1", "30.00")
        assertEquals(3000L, LedgerQueries(books.record.books).personalConsumption(Currency.CNY))
        assertEquals(0L, books.record.books.balance("card", Currency.CNY))
        assertEquals(-3000L, books.record.books.balance("cash", Currency.CNY))
    }
}
