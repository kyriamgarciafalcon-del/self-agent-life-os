package app.selfagent.v2

import android.content.Context
import app.selfagent.v2.life.CalendarEvent
import app.selfagent.v2.life.EventReminders
import app.selfagent.v2.reminders.ReminderAlarms
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

class AndroidCalendar(private val context: Context) {
    private val db = LifeDb(context).writableDatabase

    fun add(id: String, title: String, start: LocalDateTime): Int {
        db.execSQL(
            "INSERT OR IGNORE INTO calendar_event(id, title, start) VALUES (?, ?, ?)",
            arrayOf(id, title, start.toString()),
        )
        return rescheduleAlarms()
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

    fun rescheduleAlarms(): Int {
        val now = System.currentTimeMillis()
        val zone = ZoneId.systemDefault()
        val planned = all().flatMap { event ->
            val eventMs = event.start.atZone(zone).toInstant().toEpochMilli()
            EventReminders.plan(event.id, eventMs, now, event.title)
        }
        return ReminderAlarms.replaceAll(context, planned, "日程提醒")
    }

    private fun all(): List<CalendarEvent> {
        val items = mutableListOf<CalendarEvent>()
        db.rawQuery("SELECT id, title, start FROM calendar_event ORDER BY start, rowid", null).use { rows ->
            while (rows.moveToNext()) {
                items += CalendarEvent(rows.getString(0), rows.getString(1), LocalDateTime.parse(rows.getString(2)))
            }
        }
        return items
    }
}
