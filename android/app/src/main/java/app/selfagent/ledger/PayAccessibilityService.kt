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
    private var queuedEventType = 0
    private var queuedEventCount = 0

    private val scanTask = object : Runnable {
        override fun run() {
            val pkg = queuedPackage ?: return
            val fallbackText = queuedFallbackText
            val windowId = queuedWindowId
            val eventTime = queuedEventTime
            val eventType = queuedEventType
            val eventCount = queuedEventCount
            queuedPackage = null
            queuedFallbackText = ""
            queuedEventCount = 0
            PayCaptureDiagnostics.accessibilityEvents(this@PayAccessibilityService, pkg, eventType, eventCount)
            cadence.markScanned(System.currentTimeMillis())
            scan(pkg, fallbackText, windowId, eventTime)
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        PayCaptureDiagnostics.serviceConnected(this)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg !in setOf("com.tencent.mm", "com.eg.android.AlipayGphone", "com.unionpay")) return

        if (queuedPackage != pkg) queuedEventCount = 0
        queuedPackage = pkg
        queuedEventType = event.eventType
        queuedEventCount = (queuedEventCount + 1).coerceAtMost(1_000)
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
        if (text.isBlank()) {
            PayCaptureDiagnostics.scan(this, 0, "empty")
            return
        }
        if (Regex("支付密码|请输入密码|验证码|密码键盘|指纹支付").containsMatchIn(text)) {
            PayCaptureDiagnostics.scan(this, text.length, "password-screen")
            return
        }

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
        )
        if (pending == null) {
            PayCaptureDiagnostics.scan(this, text.length, "no-match")
            return
        }
        if (recent.any { it.id == pending.id }) {
            PayCaptureDiagnostics.scan(this, text.length, "duplicate-local")
            PayCaptureDiagnostics.parsed(this, duplicate = true)
            return
        }
        PayCaptureDiagnostics.scan(this, text.length, "parsed")
        PayCaptureDiagnostics.parsed(this, duplicate = false)
        recent.addFirst(pending)
        while (recent.size > 20) recent.removeLast()
        ConfirmBus.post(pending, this)
    }

    override fun onInterrupt() {
        scanHandler.removeCallbacks(scanTask)
        queuedPackage = null
        queuedFallbackText = ""
        queuedEventCount = 0
    }

    override fun onDestroy() {
        scanHandler.removeCallbacks(scanTask)
        queuedEventCount = 0
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
