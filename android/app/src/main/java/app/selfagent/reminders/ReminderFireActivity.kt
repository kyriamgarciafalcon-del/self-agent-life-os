package app.selfagent.reminders

import android.app.Activity
import android.os.Bundle

class ReminderFireActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val key = intent.getStringExtra("key")
            ?: ReminderScheduler.reminderKeyFromData(intent.dataString)
        ReminderScheduler.notifyKey(
            this,
            key,
            intent.getStringExtra(ReminderScheduler.EXTRA_TITLE) ?: "日程提醒",
            intent.getStringExtra(ReminderScheduler.EXTRA_BODY) ?: "",
        )
        ReminderScheduler.reschedule(this)
        finish()
    }
}
