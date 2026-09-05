package app.selfagent.v2.reminders

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
import app.selfagent.v2.MainActivity
import app.selfagent.v2.R
import app.selfagent.v2.life.TimedReminder

object ReminderAlarms {
    const val PREFS = "v2_reminders"
    const val CHANNEL = "v2_life_reminders_alarm"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    private const val KEYS = "scheduled_keys"

    fun keyFromData(data: String?): String = data?.removePrefix("selfagent-v2://reminder/").orEmpty()

    fun schedule(context: Context, reminders: List<TimedReminder>, title: String): Int =
        replaceAll(context, reminders, title)

    fun replaceAll(context: Context, reminders: List<TimedReminder>, title: String): Int {
        val app = context.applicationContext
        val alarm = app.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val prefs = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getStringSet(KEYS, emptySet())?.forEach { key -> cancel(app, alarm, key) }
        val keys = mutableSetOf<String>()
        for (reminder in reminders) {
            persist(app, reminder.key, title, reminder.body)
            setAlarm(app, alarm, reminder.key, reminder.whenMs, title, reminder.body)
            keys += reminder.key
        }
        prefs.edit().putStringSet(KEYS, keys).apply()
        return keys.size
    }

    fun notifyKey(context: Context, key: String, fallbackTitle: String, fallbackBody: String) {
        val stored = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("msg:$key", null)
        val title = stored?.substringBefore('\u0000')?.ifBlank { null } ?: fallbackTitle
        val body = stored?.substringAfter('\u0000', fallbackBody) ?: fallbackBody
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            val existing = nm.getNotificationChannel(CHANNEL)
            if (existing == null || existing.importance < NotificationManager.IMPORTANCE_HIGH) {
                if (existing != null) nm.deleteNotificationChannel(CHANNEL)
                nm.createNotificationChannel(
                    NotificationChannel(CHANNEL, "日程弹窗提醒", NotificationManager.IMPORTANCE_HIGH).apply {
                        enableVibration(true)
                        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                        setBypassDnd(true)
                    },
                )
            }
        }
        val open = PendingIntent.getActivity(
            context,
            (title + body).hashCode(),
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val fullScreen = PendingIntent.getActivity(
            context,
            ("fullscreen:$key").hashCode(),
            Intent(context, ReminderFireActivity::class.java)
                .setData(Uri.parse("selfagent-v2://reminder/$key"))
                .putExtra("key", key)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
        nm.notify(
            (title + body).hashCode() and 0x7fffffff,
            builder.setSmallIcon(R.drawable.ic_stat_notify)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setContentIntent(open)
                .setFullScreenIntent(fullScreen, true)
                .setCategory(Notification.CATEGORY_ALARM)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setDefaults(Notification.DEFAULT_ALL)
                .setPriority(Notification.PRIORITY_MAX)
                .build(),
        )
    }

    private fun persist(context: Context, key: String, title: String, body: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("msg:$key", "$title\u0000$body")
            .apply()
    }

    private fun intent(context: Context, key: String): Intent =
        Intent(context, ReminderReceiver::class.java)
            .setData(Uri.parse("selfagent-v2://reminder/$key"))
            .putExtra("key", key)

    private fun cancel(context: Context, alarm: AlarmManager, key: String) {
        val pending = PendingIntent.getBroadcast(
            context,
            key.hashCode(),
            intent(context, key),
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
        ) ?: return
        alarm.cancel(pending)
        pending.cancel()
    }

    private fun setAlarm(
        context: Context,
        alarm: AlarmManager,
        key: String,
        whenMs: Long,
        title: String,
        body: String,
    ) {
        val pending = PendingIntent.getBroadcast(
            context,
            key.hashCode(),
            intent(context, key).putExtra(EXTRA_TITLE, title).putExtra(EXTRA_BODY, body),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val show = PendingIntent.getActivity(
            context,
            ("show:$key").hashCode(),
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        try {
            alarm.setAlarmClock(AlarmManager.AlarmClockInfo(whenMs, show), pending)
        } catch (_: Exception) {
            try {
                alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pending)
            } catch (_: Exception) {
                alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pending)
            }
        }
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val key = ReminderAlarms.keyFromData(intent.dataString)
        ReminderAlarms.notifyKey(
            context,
            key,
            intent.getStringExtra(ReminderAlarms.EXTRA_TITLE) ?: "日程提醒",
            intent.getStringExtra(ReminderAlarms.EXTRA_BODY).orEmpty(),
        )
    }
}

class ReminderBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        app.selfagent.v2.AndroidCalendar(context).rescheduleAlarms()
    }
}
