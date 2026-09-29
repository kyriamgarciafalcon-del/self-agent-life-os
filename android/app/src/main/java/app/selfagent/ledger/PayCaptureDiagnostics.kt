package app.selfagent.ledger

import android.content.Context
import org.json.JSONObject

object PayCaptureDiagnostics {
    private const val PREFS = "pay_capture_diagnostics"
    private const val KEY_STATE = "state"
    private const val KEY_ACTIVE = "active"
    private const val KEY_STARTED_AT = "started_at"
    private const val SESSION_WINDOW_MS = 10 * 60 * 1000L
    private val lock = Any()

    fun reset(context: Context) {
        synchronized(lock) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .remove(KEY_STATE)
                .putBoolean(KEY_ACTIVE, true)
                .putLong(KEY_STARTED_AT, System.currentTimeMillis())
                .apply()
        }
    }

    fun stop(context: Context) {
        synchronized(lock) {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_ACTIVE, false).apply()
        }
    }

    fun snapshot(context: Context): JSONObject = synchronized(lock) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val active = isActive(prefs)
        load(prefs.getString(KEY_STATE, null)).toJson().put("active", active)
    }

    fun serviceConnected(context: Context) = update(context) { it.onServiceConnected() }

    fun accessibilityEvents(context: Context, packageName: String, eventType: Int, count: Int) =
        update(context) { it.onAccessibilityEvents(packageName, eventType, count) }

    fun scan(context: Context, textLength: Int, outcome: String) =
        update(context) { it.onScan(textLength, outcome) }

    fun parsed(context: Context, duplicate: Boolean) =
        update(context) { it.onParsed(duplicate) }

    fun duplicate(context: Context) = update(context) { it.onDuplicate() }

    fun notification(context: Context, submitted: Boolean) =
        update(context) { it.onNotification(submitted) }

    private fun update(context: Context, action: (PaymentCaptureTraceState) -> Unit) {
        synchronized(lock) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            if (!isActive(prefs)) return
            val state = load(prefs.getString(KEY_STATE, null))
            action(state)
            prefs.edit().putString(KEY_STATE, state.toJson().toString()).apply()
        }
    }

    private fun isActive(prefs: android.content.SharedPreferences): Boolean {
        if (!prefs.getBoolean(KEY_ACTIVE, false)) return false
        val elapsed = System.currentTimeMillis() - prefs.getLong(KEY_STARTED_AT, 0L)
        if (elapsed !in 0L..SESSION_WINDOW_MS) {
            prefs.edit().putBoolean(KEY_ACTIVE, false).apply()
            return false
        }
        return true
    }

    private fun load(context: Context): PaymentCaptureTraceState =
        load(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_STATE, null))

    private fun load(serialized: String?): PaymentCaptureTraceState = PaymentCaptureTraceState().also { state ->
        if (!serialized.isNullOrBlank()) {
            runCatching { state.restore(JSONObject(serialized)) }
        }
    }
}
