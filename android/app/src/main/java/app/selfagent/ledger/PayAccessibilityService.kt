package app.selfagent.ledger

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import java.util.UUID

class PayAccessibilityService : AccessibilityService() {

    private val recent = ArrayDeque<PendingTxn>()
    private val cadence = AccessibilityScanCadence()
    private val scanHandler = Handler(Looper.getMainLooper())
    private var queuedPackage: String? = null
    private var queuedFallbackText = ""
    private var queuedWindowId = 0
    private var queuedEventTime = 0L

    private val scanTask = object : Runnable {
        override fun run() {
            val pkg = queuedPackage ?: return
            val fallbackText = queuedFallbackText
            val windowId = queuedWindowId
            val eventTime = queuedEventTime
            queuedPackage = null
            queuedFallbackText = ""
            cadence.markScanned(System.currentTimeMillis())
            scan(pkg, fallbackText, windowId, eventTime)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg !in setOf("com.tencent.mm", "com.eg.android.AlipayGphone", "com.unionpay")) return

        queuedPackage = pkg
        queuedFallbackText = event.source?.let { collect(it, StringBuilder(), 0).toString() }.orEmpty()
        queuedWindowId = event.windowId
        queuedEventTime = event.eventTime
        scanHandler.removeCallbacks(scanTask)
        scanHandler.postDelayed(scanTask, cadence.delayUntilNextScan(System.currentTimeMillis()))
    }

    private fun scan(pkg: String, fallbackText: String, windowId: Int, eventTime: Long) {
        val root = rootInActiveWindow
        val rootText = root
            ?.takeIf { it.packageName?.toString() == pkg }
            ?.let { collect(it, StringBuilder(), 0).toString() }
            .orEmpty()
        val text = rootText.ifBlank { fallbackText }
        if (text.isBlank()) return
        if (Regex("支付密码|请输入密码|验证码|密码键盘|指纹支付").containsMatchIn(text)) return

        val now = System.currentTimeMillis()
        val sourceEventId = UUID.nameUUIDFromBytes(
            "accessibility|$pkg|$windowId|${text.trim()}|${eventTime / 2_000L}".toByteArray()
        ).toString()
        val pending = PayParser.parse(
            pkg = pkg,
            raw = text,
            at = now,
            channel = "accessibility",
            sourceEventId = sourceEventId,
        ) ?: return
        if (recent.any { it.id == pending.id }) return
        recent.addFirst(pending)
        while (recent.size > 20) recent.removeLast()
        ConfirmBus.post(pending, this)
    }

    override fun onInterrupt() {
        scanHandler.removeCallbacks(scanTask)
        queuedPackage = null
        queuedFallbackText = ""
    }

    override fun onDestroy() {
        scanHandler.removeCallbacks(scanTask)
        super.onDestroy()
    }

    private fun collect(node: AccessibilityNodeInfo, out: StringBuilder, depth: Int): StringBuilder {
        if (depth > 14 || out.length > 1800) return out
        if (!node.isPassword) {
            val value = node.text ?: node.contentDescription
            if (!value.isNullOrBlank()) out.append(value).append(' ')
        }
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            collect(child, out, depth + 1)
        }
        return out
    }
}
