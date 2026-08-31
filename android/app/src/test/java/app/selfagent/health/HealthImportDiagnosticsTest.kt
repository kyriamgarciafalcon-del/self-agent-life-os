package app.selfagent.health

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HealthImportDiagnosticsTest {
    @Test
    fun sanitizeKeepsHealthSelectionEvidenceAndDropsIdentifiers() {
        val event = JSONObject()
            .put("stage", "candidate")
            .put("source", "gadgetbridge-direct")
            .put("table", "XIAOMI_DAILY_SUMMARY_SAMPLE")
            .put("metric", "heartRate")
            .put("date", "2026-08-31")
            .put("value", 62.0)
            .put("timestamp", 1788163200000L)
            .put("strategy", "latest-daily-summary")
            .put("candidateCount", 3)
            .put("uri", "content://private/export")
            .put("path", "/private/Gadgetbridge.zip")
            .put("mac", "AA:BB:CC:DD:EE:FF")
            .put("deviceName", "My Band")
            .put("apiKey", "secret")

        val safe = HealthImportDiagnostics.sanitize(event)

        assertEquals("candidate", safe.getString("stage"))
        assertEquals("XIAOMI_DAILY_SUMMARY_SAMPLE", safe.getString("table"))
        assertEquals(62.0, safe.getDouble("value"), 0.001)
        assertEquals(3, safe.getInt("candidateCount"))
        assertFalse(safe.has("uri"))
        assertFalse(safe.has("path"))
        assertFalse(safe.has("mac"))
        assertFalse(safe.has("deviceName"))
        assertFalse(safe.has("apiKey"))
    }

    @Test
    fun reportIsBoundedToNewestEventsAndDeclaresPrivacyBoundary() {
        val events = (1..260).map { index ->
            JSONObject().put("stage", "candidate").put("metric", "stress").put("value", index)
        }

        val report = HealthImportDiagnostics.report(events, "1.1.64", 200)
        val rows: JSONArray = report.getJSONArray("events")

        assertEquals(1, report.getInt("schemaVersion"))
        assertEquals("1.1.64", report.getString("appVersion"))
        assertTrue(report.getString("privacy").contains("不含 URI、路径、MAC、设备名、密钥"))
        assertEquals(200, rows.length())
        assertEquals(61.0, rows.getJSONObject(0).getDouble("value"), 0.001)
        assertEquals(260.0, rows.getJSONObject(199).getDouble("value"), 0.001)
    }
}
