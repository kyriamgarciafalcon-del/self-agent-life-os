package app.selfagent.reminders

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Color
import android.os.Bundle
import android.view.WindowManager

class ReminderFireActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )

        val key = intent.getStringExtra("key")
            ?: ReminderScheduler.reminderKeyFromData(intent.dataString)
        val title = intent.getStringExtra(ReminderScheduler.EXTRA_TITLE) ?: "日程提醒"
        val body = intent.getStringExtra(ReminderScheduler.EXTRA_BODY) ?: ""
        val stored = getSharedPreferences(ReminderScheduler.PREFS, MODE_PRIVATE)
            .getString("msg:$key", null)
        val actualTitle = stored?.substringBefore('\u0000')?.ifBlank { null } ?: title
        val actualBody = stored?.substringAfter('\u0000', body) ?: body

        AlertDialog.Builder(this)
            .setTitle("⏰  $actualTitle")
            .setMessage(actualBody)
            .setPositiveButton("知道了") { _, _ -> closeReminder(key, actualTitle, actualBody) }
            .setOnCancelListener { closeReminder(key, actualTitle, actualBody) }
            .setCancelable(false)
            .create()
            .apply {
                setOnShowListener {
                    getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(Color.rgb(46, 107, 79))
                }
                show()
            }
    }

    private fun closeReminder(key: String, title: String, body: String) {
        ReminderScheduler.notify(this, title, body)
        ReminderScheduler.reschedule(this)
        finishAndRemoveTask()
    }
}
