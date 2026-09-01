package app.selfagent.health

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.nio.charset.StandardCharsets
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.time.Instant

object HealthImportDiagnostics {
    private const val FILE_NAME = "health-import-diagnostics.json"
    private const val DEFAULT_MAX_EVENTS = 200
    private val allowedKeys = setOf(
        "occurredAt", "stage", "source", "kind", "table", "columns", "metric", "metrics", "date",
        "value", "timestamp", "strategy", "candidateCount", "selected", "recordCount",
        "bedEpochSeconds", "wakeEpochSeconds", "totalMinutes", "wakeMinutes", "lightMinutes",
        "deepMinutes", "remMinutes", "errorClass", "attempt",
    )
    private val metricKeys = listOf("sleepHours", "heartRate", "stress", "pai", "steps", "heightCm", "weightKg", "exerciseMin")
    private val pinnedStages = setOf("import-start", "schema", "v6-sleep-summary", "import-error")
    private val safeIdentifier = Regex("[A-Z0-9_]{1,64}")

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
                        if (column.matches(safeIdentifier)) columns.put(column)
                    }
                    safe.put(key, columns)
                }
                key == "metrics" && value is JSONObject -> {
                    val metrics = JSONObject()
                    for (metric in metricKeys) {
                        if (!value.has(metric) || value.isNull(metric)) continue
                        val number = value.optDouble(metric, Double.NaN)
                        if (number.isFinite()) metrics.put(metric, number)
                    }
                    safe.put(key, metrics)
                }
                key == "table" && value is String -> {
                    val table = value.uppercase()
                    safe.put(key, if (table.matches(safeIdentifier)) table else "REDACTED_TABLE")
                }
                value is String -> safe.put(key, value.take(128))
                value is Number || value is Boolean -> safe.put(key, value)
            }
        }
        return safe
    }

    fun report(events: List<JSONObject>, appVersion: String, maxEvents: Int = DEFAULT_MAX_EVENTS): JSONObject {
        val limit = maxOf(1, maxEvents)
        val sanitized = events.map(::sanitize)
        val pinned = sanitized.filter { it.optString("stage") in pinnedStages }
            .groupBy { it.optString("stage") }
            .values
            .flatMap { rows -> rows.takeLast(8) }
            .takeLast(limit)
        val regularSlots = (limit - pinned.size).coerceAtLeast(0)
        val regular = sanitized.filterNot { it.optString("stage") in pinnedStages }.takeLast(regularSlots)
        val kept = (pinned + regular).sortedBy { it.optString("occurredAt") }
        return JSONObject()
            .put("schemaVersion", 1)
            .put("appVersion", appVersion.take(64))
            .put("privacy", "仅含健康导入选择证据；不含 URI、路径、MAC、设备名、密钥、密码或原始数据库内容")
            .put("events", JSONArray(kept))
    }

    @Synchronized
    fun append(context: Context, event: JSONObject) {
        appendBatchLocked(context, listOf(event))
    }

    @Synchronized
    fun appendRecords(context: Context, source: String, records: JSONArray) {
        val batch = mutableListOf(
            JSONObject().put("stage", "import-result").put("source", source).put("recordCount", records.length()),
        )
        for (index in 0 until records.length()) {
            val row = records.optJSONObject(index) ?: continue
            val metrics = JSONObject()
            for (metric in metricKeys) {
                if (!row.has(metric) || row.isNull(metric)) continue
                val value = row.optDouble(metric, Double.NaN)
                if (value.isFinite()) metrics.put(metric, value)
            }
            if (metrics.length() > 0) {
                batch += JSONObject()
                    .put("stage", "selected")
                    .put("source", source)
                    .put("date", row.optString("date"))
                    .put("metrics", metrics)
                    .put("strategy", "final-import-value")
            }
        }
        appendBatchLocked(context, batch)
    }

    fun appendSchema(context: Context, source: String, table: String, columns: Collection<String>) {
        append(context, JSONObject()
            .put("stage", "schema")
            .put("source", source)
            .put("table", table.uppercase())
            .put("columns", JSONArray(columns.map { it.uppercase() }.sorted())))
    }

    @Synchronized
    fun exportJson(context: Context): String = report(readEvents(context), appVersion(context)).toString(2)

    private fun appVersion(context: Context): String = runCatching {
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "unknown"
    }.getOrDefault("unknown")

    private fun diagnosticsFile(context: Context): File = File(context.filesDir, FILE_NAME)

    private fun appendBatchLocked(context: Context, batch: List<JSONObject>) {
        val now = Instant.now().toString()
        val events = readEvents(context).toMutableList()
        batch.forEach { events += JSONObject(it.toString()).put("occurredAt", now) }
        writeReportFile(diagnosticsFile(context), report(events, appVersion(context)))
    }

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

    internal fun writeReportFile(target: File, report: JSONObject) {
        target.parentFile?.mkdirs()
        val temp = File.createTempFile("${target.name}.", ".tmp", target.parentFile)
        try {
            FileOutputStream(temp).use { output ->
                output.write(report.toString().toByteArray(StandardCharsets.UTF_8))
                output.fd.sync()
            }
            try {
                Files.move(temp.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
            } catch (_: AtomicMoveNotSupportedException) {
                Files.move(temp.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING)
            }
        } finally {
            temp.delete()
        }
    }
}
