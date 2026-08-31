package app.selfagent.health

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant

object HealthImportDiagnostics {
    private const val FILE_NAME = "health-import-diagnostics.json"
    private const val DEFAULT_MAX_EVENTS = 200
    private val allowedKeys = setOf(
        "occurredAt", "stage", "source", "kind", "table", "columns", "metric", "date",
        "value", "timestamp", "strategy", "candidateCount", "selected", "recordCount",
        "bedEpochSeconds", "wakeEpochSeconds", "totalMinutes", "wakeMinutes", "lightMinutes",
        "deepMinutes", "remMinutes", "errorClass", "attempt",
    )
    private val metricKeys = listOf("sleepHours", "heartRate", "stress", "pai", "steps", "heightCm", "weightKg", "exerciseMin")

    fun sanitize(input: JSONObject): JSONObject {
        val safe = JSONObject()
        for (key in allowedKeys) {
            if (!input.has(key) || input.isNull(key)) continue
            val value = input.opt(key)
            when {
                key == "columns" && value is JSONArray -> {
                    val columns = JSONArray()
                    for (index in 0 until minOf(value.length(), 64)) {
                        val column = value.optString(index).uppercase()
                        if (column.matches(Regex("[A-Z0-9_]{1,64}"))) columns.put(column)
                    }
                    safe.put(key, columns)
                }
                value is String -> safe.put(key, value.take(128))
                value is Number || value is Boolean -> safe.put(key, value)
            }
        }
        return safe
    }

    fun report(events: List<JSONObject>, appVersion: String, maxEvents: Int = DEFAULT_MAX_EVENTS): JSONObject {
        val kept = events.takeLast(maxOf(1, maxEvents)).map(::sanitize)
        return JSONObject()
            .put("schemaVersion", 1)
            .put("appVersion", appVersion.take(64))
            .put("privacy", "仅含健康导入选择证据；不含 URI、路径、MAC、设备名、密钥、密码或原始数据库内容")
            .put("events", JSONArray(kept))
    }

    @Synchronized
    fun append(context: Context, event: JSONObject) {
        val withTime = JSONObject(event.toString()).put("occurredAt", Instant.now().toString())
        val events = readEvents(context).toMutableList().apply { add(withTime) }
        writeReport(context, report(events, appVersion(context)))
    }

    fun appendRecords(context: Context, source: String, records: JSONArray) {
        append(context, JSONObject().put("stage", "import-result").put("source", source).put("recordCount", records.length()))
        for (index in 0 until records.length()) {
            val row = records.optJSONObject(index) ?: continue
            val date = row.optString("date")
            for (metric in metricKeys) {
                if (!row.has(metric) || row.isNull(metric)) continue
                val value = row.optDouble(metric, Double.NaN)
                if (!value.isFinite()) continue
                append(context, JSONObject()
                    .put("stage", "selected")
                    .put("source", source)
                    .put("date", date)
                    .put("metric", metric)
                    .put("value", value)
                    .put("strategy", "final-import-value"))
            }
        }
    }

    fun appendSchema(context: Context, source: String, table: String, columns: Collection<String>) {
        append(context, JSONObject()
            .put("stage", "schema")
            .put("source", source)
            .put("table", table.uppercase().take(128))
            .put("columns", JSONArray(columns.map { it.uppercase() }.sorted())))
    }

    fun exportJson(context: Context): String = report(readEvents(context), appVersion(context)).toString(2)

    private fun appVersion(context: Context): String = runCatching {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "unknown"
    }.getOrDefault("unknown")

    private fun diagnosticsFile(context: Context): File = File(context.filesDir, FILE_NAME)

    private fun readEvents(context: Context): List<JSONObject> {
        val file = diagnosticsFile(context)
        if (!file.isFile) return emptyList()
        return runCatching {
            val rows = JSONObject(file.readText()).optJSONArray("events") ?: JSONArray()
            buildList {
                for (index in 0 until rows.length()) rows.optJSONObject(index)?.let(::add)
            }
        }.getOrDefault(emptyList())
    }

    private fun writeReport(context: Context, report: JSONObject) {
        val target = diagnosticsFile(context)
        val temp = File(context.filesDir, "$FILE_NAME.tmp")
        temp.writeText(report.toString())
        if (!temp.renameTo(target)) {
            target.writeText(report.toString())
            temp.delete()
        }
    }
}
