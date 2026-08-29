package app.selfagent.quotes

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

class QuoteSyncTest {
    private fun calendar(year: Int, month: Int, day: Int, hour: Int, minute: Int): Calendar =
        Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
            set(year, month - 1, day, hour, minute, 0)
            set(Calendar.MILLISECOND, 0)
        }

    @Test
    fun nextDailyAtMovesToTomorrowWhenHourHasPassed() {
        val next = QuoteSync.nextDailyAt(18, calendar(2026, 8, 29, 18, 1))
        assertEquals(2026, next.get(Calendar.YEAR))
        assertEquals(Calendar.AUGUST, next.get(Calendar.MONTH))
        assertEquals(30, next.get(Calendar.DAY_OF_MONTH))
        assertEquals(18, next.get(Calendar.HOUR_OF_DAY))
    }

    @Test
    fun stooqSymbolMapsShanghaiCodeToCn() {
        assertEquals("510300.cn", QuoteSync.stooqSymbol("510300.SH"))
        assertEquals("aapl.us", QuoteSync.stooqSymbol("AAPL"))
    }
}
