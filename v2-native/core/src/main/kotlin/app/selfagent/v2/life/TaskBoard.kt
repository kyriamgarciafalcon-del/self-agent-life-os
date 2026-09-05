package app.selfagent.v2.life

import java.nio.file.Files
import java.nio.file.Path
import java.sql.Connection
import java.sql.DriverManager
import java.time.LocalDate

data class TodayItem(
    val ruleId: String,
    val title: String,
    val date: LocalDate,
    val completed: Boolean,
)

interface LifeTasks {
    fun addDailyRule(id: String, title: String)
    fun complete(ruleId: String, date: LocalDate)
    fun today(date: LocalDate): List<TodayItem>
    fun ruleCount(): Int
    fun instanceCount(): Int
    fun ruleExists(id: String): Boolean
}

class TaskBoard private constructor(private val connection: Connection) : LifeTasks {
    override fun addDailyRule(id: String, title: String) {
        if (ruleExists(id)) return
        connection.prepareStatement("INSERT INTO task_rule(id, title, kind) VALUES (?, ?, 'daily')").use { statement ->
            statement.setString(1, id)
            statement.setString(2, title)
            statement.executeUpdate()
        }
    }

    override fun complete(ruleId: String, date: LocalDate) {
        if (!ruleExists(ruleId)) return
        connection.prepareStatement(
            "INSERT OR IGNORE INTO task_instance(rule_id, day) VALUES (?, ?)",
        ).use { statement ->
            statement.setString(1, ruleId)
            statement.setString(2, date.toString())
            statement.executeUpdate()
        }
    }

    override fun today(date: LocalDate): List<TodayItem> {
        val items = mutableListOf<TodayItem>()
        connection.prepareStatement(
            """
            SELECT r.id, r.title,
              EXISTS(SELECT 1 FROM task_instance i WHERE i.rule_id = r.id AND i.day = ?)
            FROM task_rule r
            ORDER BY r.rowid
            """.trimIndent(),
        ).use { statement ->
            statement.setString(1, date.toString())
            statement.executeQuery().use { rows ->
                while (rows.next()) {
                    items += TodayItem(
                        ruleId = rows.getString(1),
                        title = rows.getString(2),
                        date = date,
                        completed = rows.getInt(3) != 0,
                    )
                }
            }
        }
        return items
    }

    override fun ruleCount(): Int =
        connection.createStatement().use { statement ->
            statement.executeQuery("SELECT COUNT(*) FROM task_rule").use { rows ->
                rows.next()
                rows.getInt(1)
            }
        }

    override fun instanceCount(): Int =
        connection.createStatement().use { statement ->
            statement.executeQuery("SELECT COUNT(*) FROM task_instance").use { rows ->
                rows.next()
                rows.getInt(1)
            }
        }

    override fun ruleExists(id: String): Boolean =
        connection.prepareStatement("SELECT 1 FROM task_rule WHERE id = ?").use { statement ->
            statement.setString(1, id)
            statement.executeQuery().use { it.next() }
        }

    companion object {
        fun open(path: Path): TaskBoard {
            Files.createDirectories(path.parent)
            val connection = DriverManager.getConnection("jdbc:sqlite:${path.toAbsolutePath()}")
            connection.createStatement().use { statement ->
                statement.execute(
                    """
                    CREATE TABLE IF NOT EXISTS task_rule (
                      id TEXT PRIMARY KEY,
                      title TEXT NOT NULL,
                      kind TEXT NOT NULL
                    )
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    CREATE TABLE IF NOT EXISTS task_instance (
                      rule_id TEXT NOT NULL,
                      day TEXT NOT NULL,
                      PRIMARY KEY (rule_id, day)
                    )
                    """.trimIndent(),
                )
            }
            return TaskBoard(connection)
        }
    }
}
