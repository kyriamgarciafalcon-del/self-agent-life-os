package app.selfagent.v2

import android.content.Context
import app.selfagent.v2.life.CalendarEvent
import java.time.LocalDate
import java.time.LocalDateTime

class AndroidCalendar(context: Context) {
    private val db = LifeDb(context).writableDatabase

    fun add(id: String, title: String, start: LocalDateTime) {
        db.execSQL(
            "INSERT OR IGNORE INTO calendar_event(id, title, start) VALUES (?, ?, ?)",
            arrayOf(id, title, start.toString()),
        )
    }

    fun on(date: LocalDate): List<CalendarEvent> {
        val items = mutableListOf<CalendarEvent>()
        db.rawQuery(
            "SELECT id, title, start FROM calendar_event WHERE start LIKE ? ORDER BY start, rowid",
            arrayOf("$date%"),
        ).use { rows ->
            while (rows.moveToNext()) {
                items += CalendarEvent(rows.getString(0), rows.getString(1), LocalDateTime.parse(rows.getString(2)))
            }
        }
        return items
    }
}
