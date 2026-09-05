package app.selfagent.v2

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import app.selfagent.v2.life.LifeTasks
import app.selfagent.v2.life.TodayItem
import java.time.LocalDate

class AndroidTaskBoard(context: Context) : LifeTasks {
    private val db: SQLiteDatabase = Helper(context).writableDatabase

    override fun addDailyRule(id: String, title: String) {
        if (ruleExists(id)) return
        db.execSQL("INSERT INTO task_rule(id, title, kind) VALUES (?, ?, 'daily')", arrayOf(id, title))
    }

    override fun complete(ruleId: String, date: LocalDate) {
        if (!ruleExists(ruleId)) return
        db.execSQL("INSERT OR IGNORE INTO task_instance(rule_id, day) VALUES (?, ?)", arrayOf(ruleId, date.toString()))
    }

    override fun today(date: LocalDate): List<TodayItem> {
        val items = mutableListOf<TodayItem>()
        db.rawQuery(
            """
            SELECT r.id, r.title,
              EXISTS(SELECT 1 FROM task_instance i WHERE i.rule_id = r.id AND i.day = ?)
            FROM task_rule r
            ORDER BY r.rowid
            """.trimIndent(),
            arrayOf(date.toString()),
        ).use { rows ->
            while (rows.moveToNext()) {
                items += TodayItem(rows.getString(0), rows.getString(1), date, rows.getInt(2) != 0)
            }
        }
        return items
    }

    override fun ruleCount(): Int =
        db.rawQuery("SELECT COUNT(*) FROM task_rule", null).use { rows ->
            rows.moveToFirst()
            rows.getInt(0)
        }

    override fun instanceCount(): Int =
        db.rawQuery("SELECT COUNT(*) FROM task_instance", null).use { rows ->
            rows.moveToFirst()
            rows.getInt(0)
        }

    override fun ruleExists(id: String): Boolean =
        db.rawQuery("SELECT 1 FROM task_rule WHERE id = ?", arrayOf(id)).use { it.moveToFirst() }

    private class Helper(context: Context) : SQLiteOpenHelper(context, "v2-life.sqlite", null, 1) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE task_rule (
                  id TEXT PRIMARY KEY,
                  title TEXT NOT NULL,
                  kind TEXT NOT NULL
                )
                """.trimIndent(),
            )
            db.execSQL(
                """
                CREATE TABLE task_instance (
                  rule_id TEXT NOT NULL,
                  day TEXT NOT NULL,
                  PRIMARY KEY (rule_id, day)
                )
                """.trimIndent(),
            )
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit
    }
}
