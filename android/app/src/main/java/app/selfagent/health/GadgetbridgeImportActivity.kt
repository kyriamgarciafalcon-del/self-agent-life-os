package app.selfagent.health

import android.app.Activity
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.Bundle
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

class GadgetbridgeImportActivity : Activity() {
    companion object {
        private const val PICK_FILE = 781
        private const val PREFS = "gadgetbridge_import"
        private const val URI = "database_uri"

        fun importSaved(context: Activity): Boolean {
            val uri = context.getSharedPreferences(PREFS, MODE_PRIVATE).getString(URI, null) ?: return false
            Thread { parse(context, android.net.Uri.parse(uri)) }.start()
            return true
        }

        private fun parse(context: Activity, uri: android.net.Uri) {
            try {
                val file = File.createTempFile("gadgetbridge-", ".db", context.cacheDir)
                context.contentResolver.openInputStream(uri).use { input -> requireNotNull(input) { "无法读取导出文件" }; file.outputStream().use { output -> input.copyTo(output) } }
                val db = SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY)
                val records = parseDatabase(db)
                db.close(); file.delete()
                HealthBus.post(JSONObject().put("records", records).put("source", "gadgetbridge-direct"))
                context.runOnUiThread { Toast.makeText(context, "Gadgetbridge 数据已自动导入", Toast.LENGTH_SHORT).show() }
            } catch (_: Exception) {
                context.runOnUiThread { Toast.makeText(context, "Gadgetbridge 导出文件读取失败，请重新选择数据库", Toast.LENGTH_LONG).show() }
            }
        }

        private fun parseDatabase(db: SQLiteDatabase): JSONArray {
            val days = linkedMapOf<String, JSONObject>()
            val tables = mutableListOf<String>()
            db.rawQuery("SELECT name FROM sqlite_master WHERE type='table'", null).use { c -> while (c.moveToNext()) tables += c.getString(0) }
            tables.filter { it.uppercase(Locale.ROOT).contains("PAI") }.forEach { table ->
                val cols = columns(db, table); val time = pick(cols, "TIMESTAMP", "TIME") ?: return@forEach
                val pai = pick(cols, "PAI_TODAY", "PAI_TOTAL") ?: return@forEach
                db.rawQuery("SELECT $time,$pai FROM $table", null).use { c -> while (c.moveToNext()) add(days, c.getLong(0), "pai", c.getDouble(1)) }
            }
            tables.filter { it.uppercase(Locale.ROOT).contains("STRESS") }.forEach { table ->
                val cols = columns(db, table); val time = pick(cols, "TIMESTAMP", "TIME") ?: return@forEach
                val stress = pick(cols, "STRESS") ?: return@forEach
                db.rawQuery("SELECT $time,$stress FROM $table", null).use { c -> while (c.moveToNext()) add(days, c.getLong(0), "stress", c.getDouble(1)) }
            }
            tables.filter { it.uppercase(Locale.ROOT).contains("ACTIVITY") }.forEach { table ->
                val cols = columns(db, table); val time = pick(cols, "TIMESTAMP", "TIME") ?: return@forEach
                val steps = pick(cols, "STEPS", "STEP_COUNT", "STEPS_COUNT", "SAMPLE_STEPS") ?: return@forEach
                db.rawQuery("SELECT $time,$steps FROM $table", null).use { c -> while (c.moveToNext()) add(days, c.getLong(0), "steps", c.getDouble(1)) }
            }
            val out = JSONArray(); days.toSortedMap().forEach { (_, row) -> out.put(row) }; return out
        }

        private fun columns(db: SQLiteDatabase, table: String): Set<String> = buildSet {
            db.rawQuery("PRAGMA table_info($table)", null).use { c -> while (c.moveToNext()) add(c.getString(1).uppercase(Locale.ROOT)) }
        }
        private fun pick(cols: Set<String>, vararg names: String): String? = names.firstOrNull { it in cols }
        private fun add(days: MutableMap<String, JSONObject>, rawMs: Long, kind: String, value: Double) {
            if (value <= 0 || rawMs <= 0) return
            val instant = if (rawMs < 10_000_000_000L) Instant.ofEpochSecond(rawMs) else Instant.ofEpochMilli(rawMs)
            val date = instant.atZone(ZoneId.systemDefault()).toLocalDate().toString()
            val row = days.getOrPut(date) { JSONObject().put("date", date).put("source", "gadgetbridge-direct") }
            if (kind == "steps") row.put(kind, row.optDouble(kind) + value) else if (!row.has(kind) || instant.toEpochMilli() > row.optLong("_${kind}At")) { row.put(kind, value); row.put("_${kind}At", instant.toEpochMilli()) }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply { type = "*/*"; addCategory(Intent.CATEGORY_OPENABLE) }, PICK_FILE)
    }
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != PICK_FILE || resultCode != RESULT_OK || data?.data == null) { finish(); return }
        val uri = data.data!!
        contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(URI, uri.toString()).apply()
        Thread { parse(this, uri) }.start(); finish()
    }
}
