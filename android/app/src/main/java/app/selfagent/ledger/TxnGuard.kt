package app.selfagent.ledger

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs

object TxnGuard {
    private const val PREFS = "self_agent_txn_guard"
    private const val KEY = "seen"
    private const val WINDOW_MS = 6 * 60 * 60 * 1000L

    fun fingerprint(pending: PendingTxn): String = pending.id.trim()

    fun paymentSignature(pending: PendingTxn): String =
        listOf(pending.source, pending.amount?.toString() ?: "na", pending.title, pending.dir).joinToString("|")

    fun isDuplicateObservation(existing: PendingTxn, incoming: PendingTxn): Boolean {
        if (fingerprint(existing) == fingerprint(incoming)) return true
        if (existing.channel == "unknown" || incoming.channel == "unknown") return false
        if (existing.channel == incoming.channel) return false
        return paymentSignature(existing) == paymentSignature(incoming) && abs(existing.at - incoming.at) < 12_000
    }

    fun shouldPost(context: Context, pending: PendingTxn): Boolean {
        val now = pending.at
        val key = fingerprint(pending)
        val signature = paymentSignature(pending)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val seen = JSONArray(prefs.getString(KEY, "[]"))
        val next = JSONArray()
        var duplicate = false
        for (index in 0 until seen.length()) {
            val row = seen.getJSONObject(index)
            val at = row.optLong("at")
            if (now - at > WINDOW_MS) continue
            val rowKey = row.optString("key")
            val rowChannel = row.optString("channel")
            val crossChannelMatch = rowChannel.isNotBlank() &&
                pending.channel != "unknown" &&
                rowChannel != pending.channel &&
                row.optString("signature") == signature &&
                abs(now - at) < 12_000
            if (rowKey == key || crossChannelMatch) duplicate = true
            next.put(row)
        }
        if (!duplicate) {
            next.put(
                JSONObject()
                    .put("key", key)
                    .put("signature", signature)
                    .put("channel", pending.channel)
                    .put("id", pending.id)
                    .put("at", now)
                    .put("state", "posted")
            )
            prefs.edit().putString(KEY, next.toString()).apply()
        }
        return !duplicate
    }
}
