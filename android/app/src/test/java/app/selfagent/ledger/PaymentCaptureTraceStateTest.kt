package app.selfagent.ledger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Test

class PaymentCaptureTraceStateTest {
    @Test
    fun `trace counts pipeline stages without accepting or storing transaction text`() {
        val type = runCatching { Class.forName("app.selfagent.ledger.PaymentCaptureTraceState") }.getOrNull()
        if (type == null) {
            assertNotNull("privacy-safe native payment diagnostics should exist", type)
            return
        }
        val trace = type.getDeclaredConstructor().newInstance()
        type.getMethod("onServiceConnected").invoke(trace)
        type.getMethod("onAccessibilityEvents", String::class.java, Int::class.javaPrimitiveType, Int::class.javaPrimitiveType)
            .invoke(trace, "com.tencent.mm", 2048, 4)
        type.getMethod("onScan", Int::class.javaPrimitiveType, String::class.java)
            .invoke(trace, 64, "parsed")
        type.getMethod("onParsed", Boolean::class.javaPrimitiveType).invoke(trace, false)
        type.getMethod("onNotification", Boolean::class.javaPrimitiveType).invoke(trace, true)

        @Suppress("UNCHECKED_CAST")
        val snapshot = type.getMethod("snapshot").invoke(trace) as Map<String, Any?>
        assertEquals(1, snapshot["serviceStarts"])
        assertEquals(4, snapshot["accessibilityEvents"])
        assertEquals(1, snapshot["scans"])
        assertEquals(1, snapshot["nonEmptyScans"])
        assertEquals(1, snapshot["parsed"])
        assertEquals(1, snapshot["notificationsShown"])
        assertEquals("wechat", snapshot["lastPackage"])
        assertEquals("parsed", snapshot["lastOutcome"])
        assertEquals(64, snapshot["lastTextLength"])
        assertFalse(snapshot.values.any { it?.toString()?.contains("private transaction") == true })
    }
}
