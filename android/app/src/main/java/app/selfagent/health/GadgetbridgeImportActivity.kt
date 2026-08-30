package app.selfagent.health

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.os.Bundle
import android.provider.DocumentsContract
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.time.Instant
import java.time.ZoneId
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.ZipInputStream

class GadgetbridgeImportActivity : Activity() {
    private var pickingDirectory = false

    companion object {
        private const val PICK_FILE = 781
        private const val PREFS = "gadgetbridge_import"
        private const val URI = "database_uri"
        private const val TREE_URI = "zip_tree_uri"
        private const val KIND = "file_kind"
        private const val KIND_DB = "db"
        private const val KIND_ZIP = "zip"
        private const val GB_PACKAGE = "nodomain.freeyourgadget.gadgetbridge"
        private const val TRIGGER_EXPORT = "nodomain.freeyourgadget.gadgetbridge.command.TRIGGER_EXPORT"
        private const val TRIGGER_ZIP_EXPORT = "nodomain.freeyourgadget.gadgetbridge.command.TRIGGER_ZIP_EXPORT"
        const val ACTION_DATABASE_EXPORT_SUCCESS = "nodomain.freeyourgadget.gadgetbridge.action.DATABASE_EXPORT_SUCCESS"
        const val ACTION_ZIP_EXPORT_SUCCESS = "nodomain.freeyourgadget.gadgetbridge.action.ZIP_EXPORT_SUCCESS"
        const val EXTRA_PICK_DIRECTORY = "pick_zip_directory"
        private const val MAX_DB_BYTES = 64 * 1024 * 1024
        private const val MAX_SLEEP_BIN_BYTES = 2 * 1024 * 1024
        private val parsing = AtomicBoolean(false)
        private val pendingParse = AtomicBoolean(false)

        fun importSaved(context: Context): Boolean {
            val prefs = context.getSharedPreferences(PREFS, MODE_PRIVATE)
            if (prefs.getString(TREE_URI, null) != null) {
                context.sendBroadcast(Intent(TRIGGER_ZIP_EXPORT).setPackage(GB_PACKAGE))
                return true
            }
            val uri = prefs.getString(URI, null) ?: return false
            val kind = resolvedKind(context, prefs, android.net.Uri.parse(uri))
            val trigger = if (kind == KIND_ZIP) TRIGGER_ZIP_EXPORT else TRIGGER_EXPORT
            context.sendBroadcast(Intent(trigger).setPackage(GB_PACKAGE))
            // Gadgetbridge may replace the export in place. Wait for its success broadcast
            // before reading, otherwise ZipInputStream can see a half-written archive.
            return true
        }

        fun parseSaved(context: Context): Boolean {
            val prefs = context.getSharedPreferences(PREFS, MODE_PRIVATE)
            if (prefs.getString(TREE_URI, null) == null && prefs.getString(URI, null) == null) return false
            parseAsync(context)
            return true
        }

        fun hasSaved(context: Context): Boolean =
            context.getSharedPreferences(PREFS, MODE_PRIVATE).let { it.getString(TREE_URI, null) != null || it.getString(URI, null) != null }

        private fun parseAsync(context: Context) {
            pendingParse.set(true)
            if (!parsing.compareAndSet(false, true)) return
            Thread {
                try {
                    do {
                        pendingParse.set(false)
                        val prefs = context.getSharedPreferences(PREFS, MODE_PRIVATE)
                        val source = resolveSavedSource(context, prefs)
                        if (source == null) {
                            postError(context, "所选文件夹中未找到 Gadgetbridge.zip，请先完成完整 ZIP 自动导出")
                            break
                        }
                        parse(context, source.first, source.second)
                    } while (pendingParse.get())
                } finally {
                    parsing.set(false)
                    if (pendingParse.get()) parseAsync(context)
                }
            }.start()
        }

        private fun resolveSavedSource(context: Context, prefs: android.content.SharedPreferences): Pair<android.net.Uri, String>? {
            val treeRaw = prefs.getString(TREE_URI, null)
            if (treeRaw != null) {
                val tree = android.net.Uri.parse(treeRaw)
                repeat(4) { attempt ->
                    findZipInTree(context, tree)?.let { return it to KIND_ZIP }
                    if (attempt < 3) Thread.sleep(500)
                }
                return null
            }
            val raw = prefs.getString(URI, null) ?: return null
            val uri = android.net.Uri.parse(raw)
            return uri to resolvedKind(context, prefs, uri)
        }

        private fun findZipInTree(context: Context, tree: android.net.Uri): android.net.Uri? {
            return try {
                val parentId = DocumentsContract.getTreeDocumentId(tree)
                val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parentId)
                context.contentResolver.query(
                    children,
                    arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME),
                    null,
                    null,
                    null,
                )?.use { cursor ->
                    val idColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
                    val nameColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
                    while (cursor.moveToNext()) {
                        if (cursor.getString(nameColumn).equals("Gadgetbridge.zip", ignoreCase = true)) {
                            return DocumentsContract.buildDocumentUriUsingTree(tree, cursor.getString(idColumn))
                        }
                    }
                    null
                }
            } catch (error: Exception) {
                android.util.Log.e("GadgetbridgeImport", "Failed to resolve ZIP in selected tree", error)
                null
            }
        }

        private fun postError(context: Context, message: String) {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                Toast.makeText(context, message, Toast.LENGTH_LONG).show()
            }
        }

        private fun resolvedKind(context: Context, prefs: android.content.SharedPreferences, uri: android.net.Uri): String {
            val stored = prefs.getString(KIND, null)
            if (stored == KIND_ZIP || stored == KIND_DB) return stored
            val detected = detectKind(context, uri)
            prefs.edit().putString(KIND, detected).apply()
            return detected
        }

        private fun detectKind(context: Context, uri: android.net.Uri): String {
            context.contentResolver.openInputStream(uri).use { input ->
                val magic = ByteArray(16)
                val n = requireNotNull(input) { "无法读取导出文件" }.read(magic)
                if (n >= 4 && magic[0] == 0x50.toByte() && magic[1] == 0x4B.toByte()) return KIND_ZIP
                if (n >= 15 && magic.decodeToString(0, 15) == "SQLite format 3") return KIND_DB
            }
            val name = uri.lastPathSegment.orEmpty().lowercase(Locale.ROOT)
            return if (name.endsWith(".zip")) KIND_ZIP else KIND_DB
        }

        private fun parse(context: Context, uri: android.net.Uri, kind: String) {
            var lastError: Exception? = null
            repeat(3) { attempt ->
                try {
                    val records = if (kind == KIND_ZIP) parseZip(context, uri) else parseSqliteUri(context, uri)
                    HealthBus.post(JSONObject().put("records", records).put("source", "gadgetbridge-direct"))
                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                        Toast.makeText(context, "Gadgetbridge 数据库或 ZIP（含 v6 睡眠）已导入", Toast.LENGTH_SHORT).show()
                    }
                    return
                } catch (error: Exception) {
                    lastError = error
                    if (attempt < 2) Thread.sleep(600)
                }
            }
            android.util.Log.e("GadgetbridgeImport", "Failed to read saved export after retries", lastError)
            val stage = lastError?.javaClass?.simpleName ?: "UnknownError"
            postError(context, "ZIP 读取失败（$stage）。请重新选择 ZIP 所在文件夹")
        }

        private fun parseSqliteUri(context: Context, uri: android.net.Uri): JSONArray {
            val file = File.createTempFile("gadgetbridge-", ".db", context.cacheDir)
            try {
                context.contentResolver.openInputStream(uri).use { input ->
                    requireNotNull(input) { "无法读取导出文件" }
                    copyCapped(input, file, MAX_DB_BYTES)
                }
                return openAndParse(file, emptyList())
            } finally {
                file.delete()
            }
        }

        private fun parseZip(context: Context, uri: android.net.Uri): JSONArray {
            val dbFile = File.createTempFile("gadgetbridge-", ".db", context.cacheDir)
            val sleeps = mutableListOf<XiaomiSleepV6Summary>()
            var hasDb = false
            var hasPrimary = false
            try {
                context.contentResolver.openInputStream(uri).use { input ->
                    ZipInputStream(BufferedInputStream(requireNotNull(input) { "无法读取导出文件" })).use { zip ->
                        while (true) {
                            val entry = zip.nextEntry ?: break
                            val name = entry.name.replace('\\', '/').trimStart('/')
                            if (entry.isDirectory || name.split('/').any { it == ".." }) continue
                            when {
                                name == "database/Gadgetbridge" -> {
                                    copyCapped(zip, dbFile, MAX_DB_BYTES)
                                    hasDb = true
                                    hasPrimary = true
                                }
                                name == "files/Gadgetbridge" && !hasPrimary -> {
                                    copyCapped(zip, dbFile, MAX_DB_BYTES)
                                    hasDb = true
                                }
                                name.contains("ACTIVITY_SLEEP") && name.endsWith("_v6.bin") -> {
                                    val bin = readCapped(zip, MAX_SLEEP_BIN_BYTES) ?: continue
                                    XiaomiSleepV6Parser().parse(bin)?.let { sleeps += it }
                                }
                            }
                        }
                    }
                }
                require(hasDb) { "zip missing Gadgetbridge database" }
                return openAndParse(dbFile, sleeps)
            } finally {
                dbFile.delete()
            }
        }

        private fun openAndParse(file: File, sleeps: List<XiaomiSleepV6Summary>): JSONArray {
            val db = SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY)
            try {
                val days = linkedMapOf<String, JSONObject>()
                fillFromDatabase(db, days)
                sleeps.forEach { mergeSleep(days, it) }
                return toRecords(days)
            } finally {
                db.close()
            }
        }

        private fun fillFromDatabase(db: SQLiteDatabase, days: MutableMap<String, JSONObject>) {
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
                val stress = pick(cols, "STRESS")
                if (stress != null) db.rawQuery("SELECT $time,$stress FROM $table", null).use { c -> while (c.moveToNext()) add(days, c.getLong(0), "stress", c.getDouble(1)) }
                val heart = pick(cols, "HEART_RATE")
                if (heart != null) db.rawQuery("SELECT $time,$heart FROM $table", null).use { c -> while (c.moveToNext()) add(days, c.getLong(0), "heartRate", c.getDouble(1)) }
            }
            tables.filter { it.uppercase(Locale.ROOT).contains("DAILY_SUMMARY") }.forEach { table ->
                val cols = columns(db, table); val time = pick(cols, "TIMESTAMP") ?: return@forEach
                pick(cols, "STEPS")?.let { col -> db.rawQuery("SELECT $time,$col FROM $table", null).use { c -> while (c.moveToNext()) setMetric(days, c.getLong(0), "steps", c.getDouble(1)) } }
                pick(cols, "STRESS_AVG", "STRESS")?.let { col -> db.rawQuery("SELECT $time,$col FROM $table", null).use { c -> while (c.moveToNext()) setMetric(days, c.getLong(0), "stress", c.getDouble(1)) } }
                pick(cols, "HR_AVG", "HEART_RATE")?.let { col -> db.rawQuery("SELECT $time,$col FROM $table", null).use { c -> while (c.moveToNext()) setMetric(days, c.getLong(0), "heartRate", c.getDouble(1)) } }
            }
            tables.filter { it.uppercase(Locale.ROOT) == "USER_ATTRIBUTES" }.forEach { table ->
                val cols = columns(db, table); val height = pick(cols, "HEIGHT_CM"); val weight = pick(cols, "WEIGHT_KG")
                if (height != null || weight != null) db.rawQuery("SELECT ${height ?: "NULL"},${weight ?: "NULL"},VALID_FROM_UTC FROM $table ORDER BY VALID_FROM_UTC DESC LIMIT 1", null).use { c ->
                    if (c.moveToFirst()) {
                        val timestamp = c.getLong(2)
                        if (height != null && !c.isNull(0)) add(days, timestamp, "heightCm", c.getDouble(0))
                        if (weight != null && !c.isNull(1)) add(days, timestamp, "weightKg", c.getDouble(1))
                    }
                }
            }
        }

        private fun mergeSleep(days: MutableMap<String, JSONObject>, summary: XiaomiSleepV6Summary) {
            if (summary.totalMinutes <= 0 || summary.bedEpochSeconds <= 0L) return
            setMetric(days, summary.bedEpochSeconds, "sleepHours", summary.totalMinutes / 60.0)
            val date = Instant.ofEpochSecond(summary.bedEpochSeconds).atZone(ZoneId.systemDefault()).toLocalDate().toString()
            val row = days[date] ?: return
            row.put("sleepStart", summary.bedEpochSeconds)
            row.put("sleepEnd", summary.wakeEpochSeconds)
            row.put("deep", summary.deepMinutes)
            row.put("light", summary.lightMinutes)
            row.put("rem", summary.remMinutes)
        }

        private fun toRecords(days: MutableMap<String, JSONObject>): JSONArray {
            val out = JSONArray()
            days.toSortedMap().forEach { (_, row) -> row.remove("_paiAt"); row.remove("_stressAt"); out.put(row) }
            return out
        }

        private fun setMetric(days: MutableMap<String, JSONObject>, rawMs: Long, kind: String, value: Double) {
            if (value <= 0 || rawMs <= 0) return
            val instant = if (rawMs < 10_000_000_000L) Instant.ofEpochSecond(rawMs) else Instant.ofEpochMilli(rawMs)
            val date = instant.atZone(ZoneId.systemDefault()).toLocalDate().toString()
            days.getOrPut(date) { JSONObject().put("date", date).put("source", "gadgetbridge-direct") }.put(kind, value)
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

        private fun copyCapped(input: InputStream, file: File, maxBytes: Int) {
            file.outputStream().use { output ->
                val buf = ByteArray(8192)
                var total = 0
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    total += n
                    require(total <= maxBytes) { "export too large" }
                    output.write(buf, 0, n)
                }
            }
        }

        private fun readCapped(input: InputStream, maxBytes: Int): ByteArray? {
            val out = ByteArrayOutputStream()
            val buf = ByteArray(8192)
            var total = 0
            while (true) {
                val n = input.read(buf)
                if (n < 0) break
                total += n
                if (total > maxBytes) return null
                out.write(buf, 0, n)
            }
            return out.toByteArray()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pickingDirectory = intent.getBooleanExtra(EXTRA_PICK_DIRECTORY, false)
        val picker = if (pickingDirectory) {
            Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
            }
        } else {
            Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                type = "*/*"
                putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/zip", "application/x-zip-compressed", "application/octet-stream", "application/vnd.sqlite3", "*/*"))
                addCategory(Intent.CATEGORY_OPENABLE)
            }
        }
        startActivityForResult(picker, PICK_FILE)
    }
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != PICK_FILE || resultCode != RESULT_OK || data?.data == null) { finish(); return }
        val uri = data.data!!
        val granted = data.flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        contentResolver.takePersistableUriPermission(uri, granted)
        if (pickingDirectory) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString(TREE_URI, uri.toString())
                .putString(KIND, KIND_ZIP)
                .remove(URI)
                .apply()
        } else {
            val kind = detectKind(this, uri)
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString(URI, uri.toString())
                .putString(KIND, kind)
                .remove(TREE_URI)
                .apply()
        }
        parseAsync(this); finish()
    }
}

class GadgetbridgeExportReceiver : android.content.BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            GadgetbridgeImportActivity.ACTION_DATABASE_EXPORT_SUCCESS,
            GadgetbridgeImportActivity.ACTION_ZIP_EXPORT_SUCCESS -> GadgetbridgeImportActivity.parseSaved(context)
        }
    }
}
