package app.selfagent.v2.life

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import java.time.LocalDate

class TaskBoardTest {
    @TempDir
    lateinit var dir: Path

    private fun board(): TaskBoard = TaskBoard.open(dir.resolve("life.sqlite"))

    @Test
    fun `completing a daily task three times does not clone three rules`() {
        val tasks = board()
        tasks.addDailyRule("water", "喝水")
        val day = LocalDate.parse("2026-09-05")
        repeat(3) { tasks.complete("water", day) }
        assertEquals(1, tasks.ruleCount())
        assertEquals(1, tasks.instanceCount())
        assertTrue(tasks.today(day).single().completed)
    }

    @Test
    fun `completing today does not permanently finish a daily rule`() {
        val tasks = board()
        tasks.addDailyRule("water", "喝水")
        val today = LocalDate.parse("2026-09-05")
        tasks.complete("water", today)
        assertTrue(tasks.ruleExists("water"))
        val tomorrow = tasks.today(today.plusDays(1))
        assertEquals(1, tomorrow.size)
        assertFalse(tomorrow.single().completed)
        assertEquals("喝水", tomorrow.single().title)
    }
}
