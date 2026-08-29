package app.selfagent.reminders

import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Calendar
import java.util.TimeZone

class ReminderSchedulerTest {
    private fun calendar(year: Int, month: Int, day: Int, hour: Int, minute: Int): Calendar =
        Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
            set(year, month - 1, day, hour, minute, 0)
            set(Calendar.MILLISECOND, 0)
        }

    @Test
    fun nextMonthlyDueClampsDayThirtyOneToFebruaryEnd() {
        val next = ReminderScheduler.nextMonthlyDue(31, calendar(2025, 2, 1, 8, 0))

        assertEquals(2025, next.get(Calendar.YEAR))
        assertEquals(Calendar.FEBRUARY, next.get(Calendar.MONTH))
        assertEquals(28, next.get(Calendar.DAY_OF_MONTH))
        assertEquals(9, next.get(Calendar.HOUR_OF_DAY))
        assertEquals(0, next.get(Calendar.MINUTE))
    }

    @Test
    fun nextMonthlyDueMovesToFollowingMonthWhenTodaysReminderHasPassed() {
        val next = ReminderScheduler.nextMonthlyDue(15, calendar(2025, 1, 15, 9, 1))

        assertEquals(2025, next.get(Calendar.YEAR))
        assertEquals(Calendar.FEBRUARY, next.get(Calendar.MONTH))
        assertEquals(15, next.get(Calendar.DAY_OF_MONTH))
    }

    @Test
    fun eventRemindersArmTenMinuteLeadAndOnTimeAlarms() {
        val event = calendar(2026, 8, 29, 15, 32).timeInMillis
        val now = calendar(2026, 8, 29, 15, 0).timeInMillis
        val alarms = ReminderScheduler.eventReminders("walk", event, now, "散步")

        assertEquals(2, alarms.size)
        assertEquals("schedule:walk:lead", alarms[0].key)
        assertEquals(event - 10 * 60 * 1000, alarms[0].whenMs)
        assertEquals("散步 将在 10 分钟后开始", alarms[0].body)
        assertEquals("schedule:walk:due", alarms[1].key)
        assertEquals(event, alarms[1].whenMs)
        assertEquals("散步 到点了", alarms[1].body)
    }

    @Test
    fun eventRemindersKeepOnlyTheOnTimeAlarmAfterTheLeadHasPassed() {
        val event = calendar(2026, 8, 29, 15, 32).timeInMillis
        val now = calendar(2026, 8, 29, 15, 25).timeInMillis
        val alarms = ReminderScheduler.eventReminders("walk", event, now, "散步")

        assertEquals(1, alarms.size)
        assertEquals("schedule:walk:due", alarms[0].key)
        assertEquals(event, alarms[0].whenMs)
    }

    @Test
    fun eventRemindersSkipAlarmsOnceTheEventHasStarted() {
        val event = calendar(2026, 8, 29, 15, 32).timeInMillis
        val now = calendar(2026, 8, 29, 15, 32).timeInMillis
        assertEquals(0, ReminderScheduler.eventReminders("walk", event, now, "散步").size)
    }
}
