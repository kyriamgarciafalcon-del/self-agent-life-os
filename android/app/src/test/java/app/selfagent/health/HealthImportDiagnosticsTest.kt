package app.selfagent.health

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

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
        assertEquals(200, report.getInt("retentionMaxEvents"))
        assertTrue(report.getString("privacy").contains("不含 URI、路径、MAC、设备名、密钥"))
        assertEquals(200, rows.length())
        assertEquals(61.0, rows.getJSONObject(0).getDouble("value"), 0.001)
        assertEquals(260.0, rows.getJSONObject(199).getDouble("value"), 0.001)
    }

    @Test
    fun reportPinsImportSchemaSleepAndErrorEvidenceWhenRegularEventsOverflow() {
        val events = mutableListOf(
            JSONObject().put("stage", "import-start").put("source", "gadgetbridge-direct"),
            JSONObject().put("stage", "schema").put("source", "gadgetbridge-direct").put("table", "XIAOMI_DAILY_SUMMARY_SAMPLE"),
            JSONObject().put("stage", "v6-sleep-summary").put("totalMinutes", 402),
            JSONObject().put("stage", "import-error").put("errorClass", "SQLiteException"),
        )
        events += (1..260).map { index ->
            JSONObject().put("stage", "selected").put("date", "2026-08-${((index % 28) + 1).toString().padStart(2, '0')}")
                .put("metrics", JSONObject().put("heartRate", index).put("stress", index / 2.0))
        }

        val report = HealthImportDiagnostics.report(events, "1.1.64", 20)
        val rows = report.getJSONArray("events")
        val stages = (0 until rows.length()).map { rows.getJSONObject(it).getString("stage") }

        assertTrue(stages.contains("import-start"))
        assertTrue(stages.contains("schema"))
        assertTrue(stages.contains("v6-sleep-summary"))
        assertTrue(stages.contains("import-error"))
        assertTrue(rows.toString().contains("heartRate"))
    }

    @Test
    fun sanitizeAllowsOnlyMetricNumbersAndRedactsUnexpectedTableNames() {
        val safe = HealthImportDiagnostics.sanitize(JSONObject()
            .put("stage", "selected")
            .put("table", "ACTIVITY_AA:BB:CC:DD:EE:FF")
            .put("metrics", JSONObject()
                .put("heartRate", 62)
                .put("stress", 41)
                .put("deviceName", "My Band")
                .put("apiKey", "secret")))

        assertEquals("REDACTED_TABLE", safe.getString("table"))
        assertEquals(62.0, safe.getJSONObject("metrics").getDouble("heartRate"), 0.001)
        assertFalse(safe.getJSONObject("metrics").has("deviceName"))
        assertFalse(safe.getJSONObject("metrics").has("apiKey"))
        val serialized = safe.toString()
        assertFalse(serialized.contains("AA:BB:CC:DD:EE:FF"))
        assertFalse(serialized.contains("My Band"))
        assertFalse(serialized.contains("secret"))
    }

    @Test
    fun reportSerializationNeverContainsSensitiveValuesFromNestedInput() {
        val unsafe = JSONObject()
            .put("stage", "selected")
            .put("uri", "content://private/export")
            .put("path", "/private/Gadgetbridge.zip")
            .put("mac", "AA:BB:CC:DD:EE:FF")
            .put("deviceName", "My Band")
            .put("apiKey", "secret-value")
            .put("metrics", JSONObject().put("heartRate", 62).put("password", "hunter2"))

        val serialized = HealthImportDiagnostics.report(listOf(unsafe), "1.1.64").toString()

        for (secret in listOf("content://private/export", "/private/Gadgetbridge.zip", "AA:BB:CC:DD:EE:FF", "My Band", "secret-value", "hunter2")) {
            assertFalse(serialized.contains(secret))
        }
    }

    @Test
    fun atomicReplacementLeavesOneCompleteNewestReport() {
        val directory = Files.createTempDirectory("health-diagnostics-test").toFile()
        val target = File(directory, "diagnostics.json")
        try {
            HealthImportDiagnostics.writeReportFile(target, JSONObject().put("schemaVersion", 1).put("marker", "old"))
            HealthImportDiagnostics.writeReportFile(target, JSONObject().put("schemaVersion", 1).put("marker", "new"))

            assertEquals("new", JSONObject(target.readText()).getString("marker"))
            assertEquals(listOf("diagnostics.json"), directory.list()?.sorted())
        } finally {
            directory.deleteRecursively()
        }
    }
}
