package app.selfagent.ledger

import org.json.JSONObject

class PaymentCaptureTraceState {
    private var serviceStarts = 0
    private var accessibilityEvents = 0
    private var scans = 0
    private var nonEmptyScans = 0
    private var matches = 0
    private var parsed = 0
    private var duplicates = 0
    private var notificationsSubmitted = 0
    private var lastOutcome = "idle"
    private var lastPackage = "unknown"
    private var lastEventType = 0
    private var lastTextLength = 0

    fun onServiceConnected() {
        serviceStarts = increment(serviceStarts)
    }

    fun onAccessibilityEvents(packageName: String, eventType: Int, count: Int) {
        if (count <= 0) return
        lastPackage = when (packageName) {
            "com.tencent.mm" -> "wechat"
            "com.eg.android.AlipayGphone" -> "alipay"
            "com.unionpay" -> "unionpay"
            else -> "unknown"
        }
        if (lastPackage == "unknown") return
        accessibilityEvents = (accessibilityEvents.toLong() + count).coerceAtMost(MAX_COUNT.toLong()).toInt()
        lastEventType = eventType.coerceAtLeast(0)
    }

    fun onScan(textLength: Int, outcome: String) {
        scans = increment(scans)
        lastTextLength = textLength.coerceIn(0, MAX_TEXT_LENGTH)
        if (lastTextLength > 0) nonEmptyScans = increment(nonEmptyScans)
        lastOutcome = outcome.takeIf { it in OUTCOMES } ?: "no-match"
    }

    fun onParsed(duplicate: Boolean) {
        matches = increment(matches)
        if (duplicate) {
            duplicates = increment(duplicates)
            lastOutcome = "duplicate-local"
        } else {
            parsed = increment(parsed)
            lastOutcome = "parsed"
        }
    }

    fun onDuplicate() {
        duplicates = increment(duplicates)
        lastOutcome = "duplicate-guard"
    }

    fun onNotification(submitted: Boolean) {
        if (submitted) notificationsSubmitted = increment(notificationsSubmitted)
        lastOutcome = if (submitted) "notified" else "notification-blocked"
    }

    fun snapshot(): Map<String, Any> = linkedMapOf(
        "serviceStarts" to serviceStarts,
        "accessibilityEvents" to accessibilityEvents,
        "scans" to scans,
        "nonEmptyScans" to nonEmptyScans,
        "matches" to matches,
        "parsed" to parsed,
        "duplicates" to duplicates,
        "notificationsSubmitted" to notificationsSubmitted,
        "lastOutcome" to lastOutcome,
        "lastPackage" to lastPackage,
        "lastEventType" to lastEventType,
        "lastTextLength" to lastTextLength,
    )

    fun restore(json: JSONObject) {
        serviceStarts = readCount(json, "serviceStarts")
        accessibilityEvents = readCount(json, "accessibilityEvents")
        scans = readCount(json, "scans")
        nonEmptyScans = readCount(json, "nonEmptyScans")
        matches = readCount(json, "matches")
        parsed = readCount(json, "parsed")
        duplicates = readCount(json, "duplicates")
        notificationsSubmitted = readCount(json, "notificationsSubmitted")
        lastOutcome = json.optString("lastOutcome").takeIf { it in OUTCOMES } ?: "idle"
        lastPackage = json.optString("lastPackage").takeIf { it in PACKAGES } ?: "unknown"
        lastEventType = readCount(json, "lastEventType")
        lastTextLength = readCount(json, "lastTextLength").coerceAtMost(MAX_TEXT_LENGTH)
    }

    fun toJson(): JSONObject = JSONObject(snapshot())

    private fun readCount(json: JSONObject, key: String): Int = json.optLong(key, 0L).coerceIn(0L, MAX_COUNT.toLong()).toInt()
    private fun increment(value: Int): Int = if (value >= MAX_COUNT) MAX_COUNT else value + 1

    companion object {
        private const val MAX_COUNT = 1_000_000
        private const val MAX_TEXT_LENGTH = 10_000
        private val PACKAGES = setOf("wechat", "alipay", "unionpay", "unknown")
        private val OUTCOMES = setOf("idle", "empty", "password-screen", "no-match", "parsed", "duplicate-local", "duplicate-guard", "notified", "notification-blocked")
    }
}
