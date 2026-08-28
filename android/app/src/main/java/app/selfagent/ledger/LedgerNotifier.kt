package app.selfagent.ledger

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

object LedgerNotifier {
    const val CHANNEL = "pay_confirm"
    const val ACTION_IGNORE = "app.selfagent.IGNORE_TXN"
    const val EXTRA_NOTIFY_ID = "notify_id"

    fun show(context: Context, txn: PendingTxn) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "记账确认", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "付款成功后弹出确认，不会自动改账本"
                    enableVibration(true)
                    lockscreenVisibility = Notification.VISIBILITY_PRIVATE
                }
            )
        }
        val notifyId = (txn.id.hashCode() and 0x7fffffff).let { if (it == 0) 1 else it }
        val json = ConfirmBus.toJson(txn)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val confirm = PendingIntent.getActivity(
            context, notifyId,
            MainActivity.ledgerIntent(context, json, autoSave = true),
            flags
        )
        val review = PendingIntent.getActivity(
            context, notifyId + 1,
            MainActivity.ledgerIntent(context, json, autoSave = false),
            flags
        )
        val ignore = PendingIntent.getBroadcast(
            context, notifyId + 2,
            Intent(ACTION_IGNORE).setPackage(context.packageName).putExtra(EXTRA_NOTIFY_ID, notifyId),
            flags
        )
        val amount = txn.amount?.let { "¥$it" } ?: "金额待确认"
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
        val notification = builder
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("待确认记账")
            .setContentText("${txn.title}  $amount")
            .setStyle(Notification.BigTextStyle().bigText("${txn.title}  $amount\n来源：${sourceLabel(txn.source)}\n点确认入账，或忽略。"))
            .setAutoCancel(true)
            .setContentIntent(review)
            .setPriority(Notification.PRIORITY_HIGH)
            .setDefaults(Notification.DEFAULT_ALL)
            .addAction(Notification.Action.Builder(0, "确认入账", confirm).build())
            .addAction(Notification.Action.Builder(0, "忽略", ignore).build())
            .build()
        nm.notify(notifyId, notification)
    }

    private fun sourceLabel(source: String) = when (source) {
        "wechat" -> "微信"
        "alipay" -> "支付宝"
        "unionpay" -> "云闪付"
        else -> source
    }
}

class LedgerIgnoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra(LedgerNotifier.EXTRA_NOTIFY_ID, 0)
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (id != 0) nm.cancel(id)
    }
}
