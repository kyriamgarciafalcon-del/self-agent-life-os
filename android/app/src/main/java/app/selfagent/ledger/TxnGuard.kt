package app.selfagent.ledger

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

object TxnGuard {
    private const val PREFS = "self_agent_txn_guard"
    private const val KEY = "seen"
    private const val WINDOW_MS = 6 * 60 * 60 * 1000L

    fun fingerprint(pending: PendingTxn): String =
        listOf(pending.source, pending.amount?.toString() ?: "na", pending.title, pending.dir).joinToString("|")

    fun shouldPost(context: Context, pending: PendingTxn): Boolean {
        val now = pending.at
        val key = fingerprint(pending)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val seen = JSONArray(prefs.getString(KEY, "[]"))
        val next = JSONArray()
        var duplicate = false
        for (index in 0 until seen.length()) {
            val row = seen.getJSONObject(index)
            val at = row.optLong("at")
            if (now - at > WINDOW_MS) continue
            if (row.optString("key") == key && abs(now - at) < 180_000) duplicate = true
            next.put(row)
        }
        if (!duplicate) {
            next.put(JSONObject().put("key", key).put("id", pending.id).put("at", now).put("state", "posted"))
            prefs.edit().putString(KEY, next.toString()).apply()
        }
        return !duplicate
    }
}
