package app.selfagent.v2.life

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import java.time.LocalDate
import java.time.LocalDateTime

class CalendarBoardTest {
    @TempDir
    lateinit var dir: Path

    @Test
    fun `event belongs to local calendar day and is not a task rule`() {
        val tasks = TaskBoard.open(dir.resolve("life.sqlite"))
        val calendar = CalendarBoard.open(dir.resolve("life.sqlite"))
        calendar.add(
            id = "meet",
            title = "周会",
            start = LocalDateTime.parse("2026-09-05T15:00:00"),
        )
        assertEquals(listOf("周会"), calendar.on(LocalDate.parse("2026-09-05")).map { it.title })
        assertEquals(emptyList<CalendarEvent>(), calendar.on(LocalDate.parse("2026-09-06")))
        assertEquals(0, tasks.ruleCount())
    }
}
