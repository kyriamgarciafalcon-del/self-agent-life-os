package app.selfagent.reminders

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import app.selfagent.MainActivity
import app.selfagent.R
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

object ReminderScheduler {
    const val PREFS = "self_agent_reminders"
    const val KEY_PAYLOAD = "payload"
    const val CHANNEL = "life_reminders"
    const val ACTION_FIRE = "app.selfagent.REMINDER_FIRE"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"

    fun sync(context: Context, raw: String) {
        val app = context.applicationContext
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_PAYLOAD, raw).apply()
        schedule(app, raw)
    }

    fun reschedule(context: Context) {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PAYLOAD, null) ?: return
        schedule(context.applicationContext, raw)
    }

    private fun schedule(context: Context, raw: String) {
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val payload = JSONObject(raw)
        val now = System.currentTimeMillis()
        val schedules = payload.optJSONArray("schedules") ?: JSONArray()
        for (index in 0 until schedules.length()) {
            val item = schedules.getJSONObject(index)
            val whenMs = parseLocal(item.optString("date"), item.optString("time")) - 10 * 60 * 1000
            if (whenMs > now) setAlarm(context, alarm, item.optString("id").hashCode(), whenMs, "日程提醒", "${item.optString("title")} 将在 10 分钟后开始")
        }
        val month = payload.optString("month")
        val bills = payload.optJSONArray("bills") ?: JSONArray()
        val today = Calendar.getInstance()
        val todayDay = today.get(Calendar.DAY_OF_MONTH)
        val thisMonth = String.format("%04d-%02d", today.get(Calendar.YEAR), today.get(Calendar.MONTH) + 1)
        for (index in 0 until bills.length()) {
            val bill = bills.getJSONObject(index)
            if (bill.optString("lastRunPeriod") == thisMonth) continue
            if (bill.optInt("dueDay") != todayDay) continue
            val whenMs = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 9)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis
            val fireAt = if (whenMs > now) whenMs else now + 15_000
            setAlarm(context, alarm, bill.optString("id").hashCode(), fireAt, "每月账单", "${bill.optString("name")} 今天到期，确认后才会入账")
        }
        month.hashCode()
    }

    private fun parseLocal(date: String, time: String): Long {
        val parts = date.split("-")
        val clock = time.split(":")
        if (parts.size < 3 || clock.isEmpty()) return 0L
        return Calendar.getInstance().apply {
            set(Calendar.YEAR, parts[0].toInt())
            set(Calendar.MONTH, parts[1].toInt() - 1)
            set(Calendar.DAY_OF_MONTH, parts[2].toInt())
            set(Calendar.HOUR_OF_DAY, clock[0].toInt())
            set(Calendar.MINUTE, if (clock.size > 1) clock[1].toInt() else 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis
    }

    private fun setAlarm(context: Context, alarm: AlarmManager, requestCode: Int, whenMs: Long, title: String, body: String) {
        val intent = Intent(ACTION_FIRE).setPackage(context.packageName)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_BODY, body)
        val pending = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
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
    }
}

class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) ReminderScheduler.reschedule(context)
    }
}
