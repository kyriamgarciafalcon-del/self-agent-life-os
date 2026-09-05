package app.selfagent.v2.life

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class EventRemindersTest {
    @Test
    fun `arms lead and on-time when both are in the future`() {
        val event = 1_000_000L
        val now = event - 20 * 60 * 1000
        val alarms = EventReminders.plan("walk", event, now, "散步")
        assertEquals(2, alarms.size)
        assertEquals("schedule:walk:lead", alarms[0].key)
        assertEquals(event - 10 * 60 * 1000, alarms[0].whenMs)
        assertEquals("散步 将在 10 分钟后开始", alarms[0].body)
        assertEquals("schedule:walk:due", alarms[1].key)
        assertEquals(event, alarms[1].whenMs)
        assertEquals("散步 到点了", alarms[1].body)
    }

    @Test
    fun `keeps on-time after the lead has passed`() {
        val event = 1_000_000L
        val now = event - 5 * 60 * 1000
        val alarms = EventReminders.plan("walk", event, now, "散步")
        assertEquals(listOf("schedule:walk:due"), alarms.map { it.key })
    }

    @Test
    fun `skips alarms once the event has started`() {
        assertEquals(0, EventReminders.plan("walk", 1_000_000L, 1_000_000L, "散步").size)
    }
}
