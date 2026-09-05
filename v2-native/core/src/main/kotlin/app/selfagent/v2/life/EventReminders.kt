package app.selfagent.v2.life

data class TimedReminder(val key: String, val whenMs: Long, val body: String)

object EventReminders {
    fun plan(id: String, eventMs: Long, nowMs: Long, title: String): List<TimedReminder> {
        if (eventMs <= 0L) return emptyList()
        val leadMs = eventMs - 10 * 60 * 1000
        val items = mutableListOf<TimedReminder>()
        if (leadMs > nowMs) items += TimedReminder("schedule:$id:lead", leadMs, "$title 将在 10 分钟后开始")
        if (eventMs > nowMs) items += TimedReminder("schedule:$id:due", eventMs, "$title 到点了")
        return items
    }
}
