package app.selfagent.reminders

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import app.selfagent.MainActivity
import app.selfagent.R
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

object ReminderScheduler {
    const val PREFS = "self_agent_reminders"
    const val KEY_PAYLOAD = "payload"
    private const val KEY_SCHEDULED_KEYS = "scheduled_keys"
    const val CHANNEL = "life_reminders"
    const val ACTION_FIRE = "app.selfagent.REMINDER_FIRE"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"

    fun sync(context: Context, raw: String) {
        updateAlarms(context.applicationContext, raw)
    }

    fun reschedule(context: Context) {
        val app = context.applicationContext
        val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_PAYLOAD, null)
        if (raw == null) {
            cancelStoredAlarms(app, prefs)
            return
        }
        updateAlarms(app, raw)
    }

    private fun updateAlarms(context: Context, raw: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        cancelStoredAlarms(context, prefs)
        val scheduledKeys = schedule(context, raw)
        prefs.edit()
            .putString(KEY_PAYLOAD, raw)
            .putStringSet(KEY_SCHEDULED_KEYS, scheduledKeys)
            .apply()
    }

    private fun cancelStoredAlarms(context: Context, prefs: android.content.SharedPreferences) {
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        prefs.getStringSet(KEY_SCHEDULED_KEYS, emptySet())
            ?.forEach { key -> cancelAlarm(context, alarm, key) }
    }

    private fun schedule(context: Context, raw: String): Set<String> {
        val payload = runCatching { JSONObject(raw) }.getOrNull() ?: return emptySet()
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val now = System.currentTimeMillis()
        val scheduledKeys = mutableSetOf<String>()
        val schedules = payload.optJSONArray("schedules") ?: JSONArray()
        for (index in 0 until schedules.length()) {
            val item = schedules.optJSONObject(index) ?: continue
            if (!isActive(item)) continue
            val key = "schedule:${item.optString("id")}".takeUnless { it == "schedule:" } ?: continue
            val whenMs = parseLocal(item.optString("date"), item.optString("time")) - 10 * 60 * 1000
            if (whenMs > now) {
                setAlarm(context, alarm, key, whenMs, "日程提醒", "${item.optString("title")} 将在 10 分钟后开始")
                scheduledKeys += key
            }
        }

        val bills = payload.optJSONArray("bills") ?: JSONArray()
        val current = Calendar.getInstance()
        for (index in 0 until bills.length()) {
            val bill = bills.optJSONObject(index) ?: continue
            if (!isActive(bill)) continue
            val key = "bill:${bill.optString("id")}".takeUnless { it == "bill:" } ?: continue
            val dueAt = nextMonthlyDue(bill.optInt("dueDay"), current)
            if (bill.optString("lastRunPeriod") == monthKey(current) &&
                dueAt.get(Calendar.YEAR) == current.get(Calendar.YEAR) &&
                dueAt.get(Calendar.MONTH) == current.get(Calendar.MONTH)
            ) {
                dueAt.add(Calendar.MONTH, 1)
                dueAt.set(Calendar.DAY_OF_MONTH, bill.optInt("dueDay").coerceAtLeast(1).coerceAtMost(dueAt.getActualMaximum(Calendar.DAY_OF_MONTH)))
            }
            setAlarm(context, alarm, key, dueAt.timeInMillis, "每月账单", "${bill.optString("name")} 即将到期，确认后才会入账")
            scheduledKeys += key
        }
        return scheduledKeys
    }

    private fun isActive(item: JSONObject): Boolean {
        val status = item.optString("status").lowercase()
        return item.optBoolean("enabled", true) &&
            !item.optBoolean("paused", false) &&
            !item.optBoolean("completed", false) &&
            !item.optBoolean("isCompleted", false) &&
            status !in setOf("completed", "paused", "deleted", "cancelled", "canceled")
    }

    private fun monthKey(calendar: Calendar): String =
        "%04d-%02d".format(calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH) + 1)

    internal fun nextMonthlyDue(dueDay: Int, now: Calendar): Calendar {
        val due = (now.clone() as Calendar).apply {
            set(Calendar.DAY_OF_MONTH, 1)
            set(Calendar.HOUR_OF_DAY, 9)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            set(Calendar.DAY_OF_MONTH, dueDay.coerceAtLeast(1).coerceAtMost(getActualMaximum(Calendar.DAY_OF_MONTH)))
        }
        if (due.timeInMillis <= now.timeInMillis) {
            due.add(Calendar.MONTH, 1)
            due.set(Calendar.DAY_OF_MONTH, dueDay.coerceAtLeast(1).coerceAtMost(due.getActualMaximum(Calendar.DAY_OF_MONTH)))
        }
        return due
    }

    private fun parseLocal(date: String, time: String): Long = runCatching {
        val parts = date.split("-")
        val clock = time.split(":")
        require(parts.size == 3 && clock.isNotEmpty())
        Calendar.getInstance().apply {
            isLenient = false
            set(Calendar.YEAR, parts[0].toInt())
            set(Calendar.MONTH, parts[1].toInt() - 1)
            set(Calendar.DAY_OF_MONTH, parts[2].toInt())
            set(Calendar.HOUR_OF_DAY, clock[0].toInt())
            set(Calendar.MINUTE, if (clock.size > 1) clock[1].toInt() else 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }.getOrDefault(0L)

    private fun alarmIntent(context: Context, key: String): Intent =
        Intent(ACTION_FIRE)
            .setPackage(context.packageName)
            .setData(Uri.parse("selfagent://reminder/$key"))

    private fun cancelAlarm(context: Context, alarm: AlarmManager, key: String) {
        val pending = PendingIntent.getBroadcast(
            context,
            key.hashCode(),
            alarmIntent(context, key),
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        ) ?: return
        alarm.cancel(pending)
        pending.cancel()
    }

    private fun setAlarm(context: Context, alarm: AlarmManager, key: String, whenMs: Long, title: String, body: String) {
        val pending = PendingIntent.getBroadcast(
            context,
            key.hashCode(),
            alarmIntent(context, key)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_BODY, body),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        try {
            alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pending)
        } catch (_: Exception) {
            alarm.set(AlarmManager.RTC_WAKEUP, whenMs, pending)
        }
    }

    fun notify(context: Context, title: String, body: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "日程与账单提醒", NotificationManager.IMPORTANCE_HIGH))
        }
        val open = PendingIntent.getActivity(
            context,
            title.hashCode(),
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
        nm.notify(
            (title + body).hashCode() and 0x7fffffff,
            builder.setSmallIcon(R.drawable.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setContentIntent(open)
                .build()
        )
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        ReminderScheduler.notify(
            context,
            intent.getStringExtra(ReminderScheduler.EXTRA_TITLE) ?: "提醒",
            intent.getStringExtra(ReminderScheduler.EXTRA_BODY) ?: ""
        )
        ReminderScheduler.reschedule(context)
    }
}

class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED -> ReminderScheduler.reschedule(context)
        }
    }
}
