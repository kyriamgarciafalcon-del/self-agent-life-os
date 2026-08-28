package app.selfagent.ledger

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class PayAccessibilityService : AccessibilityService() {

    private val recent = ArrayDeque<PendingTxn>()
    private var lastScanAt = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg !in setOf("com.tencent.mm", "com.eg.android.AlipayGphone", "com.unionpay")) return
        val now = System.currentTimeMillis()
        if (now - lastScanAt < 400) return
        lastScanAt = now
        val root = rootInActiveWindow ?: event.source ?: return
        try {
            val text = collect(root, StringBuilder(), 0).toString()
            if (text.isBlank()) return
            if (Regex("支付密码|请输入密码|验证码|密码键盘|指纹支付").containsMatchIn(text)) return
            val pending = PayParser.parse(pkg, text) ?: return
            if (recent.any { same(it, pending) }) return
            recent.addFirst(pending)
            while (recent.size > 20) recent.removeLast()
            ConfirmBus.post(pending, this)
        } finally {
            // AccessibilityNodeInfo.recycle is a no-op on current Android versions.
        }
    }

    override fun onInterrupt() = Unit

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

    private fun same(a: PendingTxn, b: PendingTxn) =
        a.source == b.source && a.amount == b.amount && a.title == b.title &&
            kotlin.math.abs(a.at - b.at) < 12_000
}
