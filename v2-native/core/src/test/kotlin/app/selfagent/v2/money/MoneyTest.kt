package app.selfagent.v2.money

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class MoneyTest {
    @Test
    fun `parses yuan-scale currency from decimal string without Double`() {
        val money = Money.parse("0.29", Currency.CNY)
        assertEquals(29L, money.minor)
        assertEquals(Currency.CNY, money.currency)
    }

    @Test
    fun `parses whole yen without a decimal point`() {
        val money = Money.parse("30", Currency.JPY)
        assertEquals(30L, money.minor)
    }

    @Test
    fun `rejects yen with a fractional part`() {
        assertThrows(MoneyException::class.java) { Money.parse("30.1", Currency.JPY) }
    }

    @Test
    fun `rejects extra fraction that would require rounding`() {
        assertThrows(MoneyException::class.java) { Money.parse("1.001", Currency.CNY) }
    }

    @Test
    fun `rejects blank illegal and unknown currency`() {
        assertThrows(MoneyException::class.java) { Money.parse("", Currency.CNY) }
        assertThrows(MoneyException::class.java) { Money.parse("abc", Currency.USD) }
        assertThrows(MoneyException::class.java) { Money.parse("1.00", Currency.parse("XXX")) }
    }

    @Test
    fun `does not coerce invalid amounts to zero or absolute value`() {
        val error = assertThrows(MoneyException::class.java) { Money.parse("-", Currency.CNY) }
        assertEquals(MoneyError.INVALID, error.code)
    }

    @Test
    fun `plus and minus reject overflow and mixed currencies`() {
        val max = Money(Long.MAX_VALUE, Currency.CNY)
        assertThrows(MoneyException::class.java) { max.plus(Money.parse("0.01", Currency.CNY)) }
        val cny = Money.parse("1.00", Currency.CNY)
        val usd = Money.parse("1.00", Currency.USD)
        assertThrows(MoneyException::class.java) { cny.plus(usd) }
    }
}
