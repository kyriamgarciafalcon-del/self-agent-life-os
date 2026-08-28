package app.selfagent.ledger

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class PayNotificationService : NotificationListenerService() {

    private val allow = setOf(
        "com.tencent.mm",
        "com.eg.android.AlipayGphone",
        "com.unionpay"
    )
    private val recent = ArrayDeque<PendingTxn>()

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (sbn.packageName !in allow) return
        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
        val raw = "$title $text $big"
        val pending = PayParser.parse(sbn.packageName, raw) ?: return
        if (recent.any { same(it, pending) }) return
        recent.addFirst(pending)
        while (recent.size > 20) recent.removeLast()
        ConfirmBus.post(pending)
    }

    private fun same(a: PendingTxn, b: PendingTxn) =
        a.source == b.source && a.amount == b.amount && a.title == b.title &&
            kotlin.math.abs(a.at - b.at) < 10_000
}
