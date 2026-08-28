package app.selfagent.ledger

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import app.selfagent.travel.TravelBus
import app.selfagent.travel.TravelParser

class PayNotificationService : NotificationListenerService() {

    private val payApps = setOf(
        "com.tencent.mm",
        "com.eg.android.AlipayGphone",
        "com.unionpay",
    )
    private val travelApps = setOf(
        "com.MobileTicket",
        "com.umetrip.android.msky.app",
        "com.flightmanager.view",
        "com.veryzhun.flight",
        "com.android.mms",
        "com.google.android.apps.messaging",
        "com.android.messaging",
        "com.samsung.android.messaging",
        "com.miui.sms",
        "com.tencent.mm",
    )
    private val recentPay = ArrayDeque<PendingTxn>()
    private val recentTrip = ArrayDeque<String>()

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
        val raw = "$title $text $big"
        if (sbn.packageName in travelApps) {
            val trip = TravelParser.parse(raw)
            if (trip != null) {
                val key = "${trip.kind}-${trip.number}-${trip.departAt}"
                if (key !in recentTrip) {
                    recentTrip.addFirst(key)
                    while (recentTrip.size > 30) recentTrip.removeLast()
                    TravelBus.post(trip)
                }
            }
        }
        if (sbn.packageName !in payApps) return
        val pending = PayParser.parse(sbn.packageName, raw) ?: return
        if (recentPay.any { same(it, pending) }) return
        recentPay.addFirst(pending)
        while (recentPay.size > 20) recentPay.removeLast()
        ConfirmBus.post(pending, this)
    }

    private fun same(a: PendingTxn, b: PendingTxn) =
        a.source == b.source && a.amount == b.amount && a.title == b.title &&
            kotlin.math.abs(a.at - b.at) < 10_000
}
