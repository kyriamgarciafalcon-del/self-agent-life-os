package app.selfagent.v2.life

import java.nio.file.Files
import java.nio.file.Path
import java.sql.Connection
import java.sql.DriverManager
import java.time.LocalDate
import java.time.LocalDateTime

data class CalendarEvent(
    val id: String,
    val title: String,
    val start: LocalDateTime,
)

class CalendarBoard private constructor(private val connection: Connection) {
    fun add(id: String, title: String, start: LocalDateTime) {
        connection.prepareStatement(
            "INSERT OR IGNORE INTO calendar_event(id, title, start) VALUES (?, ?, ?)",
        ).use { statement ->
            statement.setString(1, id)
            statement.setString(2, title)
            statement.setString(3, start.toString())
            statement.executeUpdate()
        }
    }

    fun on(date: LocalDate): List<CalendarEvent> {
        val items = mutableListOf<CalendarEvent>()
        connection.prepareStatement(
            "SELECT id, title, start FROM calendar_event WHERE start LIKE ? ORDER BY start, rowid",
        ).use { statement ->
            statement.setString(1, "$date%")
            statement.executeQuery().use { rows ->
                while (rows.next()) {
                    items += CalendarEvent(
                        id = rows.getString(1),
                        title = rows.getString(2),
                        start = LocalDateTime.parse(rows.getString(3)),
                    )
                }
            }
        }
        return items
    }

    companion object {
        fun open(path: Path): CalendarBoard {
            Files.createDirectories(path.parent)
            val connection = DriverManager.getConnection("jdbc:sqlite:${path.toAbsolutePath()}")
            connection.createStatement().use { statement ->
                statement.execute(
                    """
                    CREATE TABLE IF NOT EXISTS calendar_event (
                      id TEXT PRIMARY KEY,
                      title TEXT NOT NULL,
                      start TEXT NOT NULL
                    )
                    """.trimIndent(),
                )
            }
            return CalendarBoard(connection)
        }
    }
}
