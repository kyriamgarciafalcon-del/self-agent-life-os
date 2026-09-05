package app.selfagent.v2.money

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class MoneyDefaultCurrencyTest {
    @Test
    fun `parse without currency defaults to CNY`() {
        val money = Money.parse("0.29")
        assertEquals(29L, money.minor)
        assertEquals(Currency.CNY, money.currency)
    }
}
