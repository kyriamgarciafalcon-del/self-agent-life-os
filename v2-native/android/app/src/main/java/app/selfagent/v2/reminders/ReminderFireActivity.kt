package app.selfagent.v2.reminders

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
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
        )
        val key = intent.getStringExtra("key") ?: ReminderAlarms.keyFromData(intent.dataString)
        val stored = getSharedPreferences(ReminderAlarms.PREFS, MODE_PRIVATE).getString("msg:$key", null)
        val title = stored?.substringBefore('\u0000')?.ifBlank { null }
            ?: intent.getStringExtra(ReminderAlarms.EXTRA_TITLE)
            ?: "日程提醒"
        val body = stored?.substringAfter('\u0000', "") ?: intent.getStringExtra(ReminderAlarms.EXTRA_BODY).orEmpty()
        AlertDialog.Builder(this)
            .setTitle("⏰  $title")
            .setMessage(body)
            .setPositiveButton("知道了") { _, _ -> finishAndRemoveTask() }
            .setOnCancelListener { finishAndRemoveTask() }
            .setCancelable(false)
            .create()
            .apply {
                setOnShowListener { getButton(AlertDialog.BUTTON_POSITIVE).setTextColor(Color.rgb(46, 107, 79)) }
                show()
            }
    }
}
