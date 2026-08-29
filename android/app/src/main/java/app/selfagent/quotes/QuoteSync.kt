package app.selfagent.quotes

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import app.selfagent.MainActivity
import app.selfagent.R
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar
import java.util.concurrent.Executors

object QuoteSync {
    const val PREFS = "self_agent_quotes"
    const val KEY_PAYLOAD = "payload"
    const val CHANNEL = "daily_quotes"
    const val ACTION_FIRE = "app.selfagent.QUOTE_FIRE"
    private const val ALARM_KEY = "quote:daily"
    private val executor = Executors.newSingleThreadExecutor()

    fun sync(context: Context, raw: String) {
        val app = context.applicationContext
        app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_PAYLOAD, raw).apply()
        schedule(app, JSONObject(raw).optInt("hour", 18))
    }

    fun refreshNow(context: Context) {
        val app = context.applicationContext
        val raw = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PAYLOAD, null) ?: return
        executor.execute { fetchAndPost(app, raw) }
    }

    fun reschedule(context: Context) {
        val app = context.applicationContext
        val raw = app.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_PAYLOAD, null) ?: return
        schedule(app, JSONObject(raw).optInt("hour", 18))
    }

    internal fun nextDailyAt(hour: Int, now: Calendar): Calendar {
        val due = (now.clone() as Calendar).apply {
            set(Calendar.HOUR_OF_DAY, hour.coerceIn(0, 23))
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (due.timeInMillis <= now.timeInMillis) due.add(Calendar.DAY_OF_MONTH, 1)
        return due
    }

    internal fun stooqSymbol(code: String): String {
        val value = code.trim().lowercase()
        if (value.endsWith(".sh") || value.endsWith(".sz") || value.endsWith(".ss")) return value.substringBefore('.') + ".cn"
        if (value.contains('.')) return value
        return "$value.us"
    }

    private fun schedule(context: Context, hour: Int) {
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val due = nextDailyAt(hour, Calendar.getInstance())
        val pending = PendingIntent.getBroadcast(
            context,
            ALARM_KEY.hashCode(),
            Intent(ACTION_FIRE).setPackage(context.packageName).setData(Uri.parse("selfagent://quote/$ALARM_KEY")),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        try {
            alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, due.timeInMillis, pending)
        } catch (_: Exception) {
            alarm.set(AlarmManager.RTC_WAKEUP, due.timeInMillis, pending)
        }
    }

    private fun fetchAndPost(context: Context, raw: String) {
        val request = runCatching { JSONObject(raw) }.getOrNull() ?: return
        val rates = JSONArray()
        val quotes = JSONArray()
        val currencies = request.optJSONArray("currencies") ?: JSONArray()
        for (index in 0 until currencies.length()) {
            val currency = currencies.optString(index)
            if (currency.isBlank() || currency == "CNY") continue
            fetchFx(currency)?.let { rates.put(it) }
        }
        val holdings = request.optJSONArray("holdings") ?: JSONArray()
        for (index in 0 until holdings.length()) {
            val holding = holdings.optJSONObject(index) ?: continue
            fetchQuote(holding)?.let { quotes.put(it) }
        }
        if (rates.length() == 0 && quotes.length() == 0) return
        val payload = JSONObject().put("rates", rates).put("quotes", quotes)
        QuoteBus.post(payload)
        notify(context, "今日参考价已更新", "汇率 ${rates.length()} 条 · 价格 ${quotes.length()} 条，只更新估值")
        schedule(context, request.optInt("hour", 18))
    }

    private fun fetchFx(currency: String): JSONObject? {
        val body = get("https://api.frankfurter.dev/v1/latest?base=$currency&symbols=CNY") ?: return null
        val json = runCatching { JSONObject(body) }.getOrNull() ?: return null
        val rate = json.optJSONObject("rates")?.optDouble("CNY") ?: return null
        if (!(rate > 0)) return null
        val asOf = json.optString("date")
        return JSONObject().put("currency", currency).put("cnyRate", rate).put("asOf", asOf).put("source", "daily").put("updatedAt", asOf + "T18:00:00")
    }

    private fun fetchQuote(holding: JSONObject): JSONObject? {
        val code = holding.optString("code")
        if (code.isBlank()) return null
        val csv = get("https://stooq.com/q/l/?s=${stooqSymbol(code)}&f=sd2t2ohlcv&h&e=csv") ?: return null
        val rows = csv.lines().map { it.trim() }.filter { it.isNotEmpty() }
        if (rows.size < 2) return null
        val cols = rows[1].split(',')
        if (cols.size < 7) return null
        val date = cols[1]
        val close = cols[6].toDoubleOrNull() ?: return null
        if (!(close > 0) || !date.matches(Regex("\\d{4}-\\d{2}-\\d{2}"))) return null
        return JSONObject().put("holdingId", holding.optString("id")).put("price", close).put("asOf", date + "T18:00:00").put("source", "stooq")
    }

    private fun get(url: String): String? {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 8000
            readTimeout = 8000
            requestMethod = "GET"
            setRequestProperty("User-Agent", "SelfAgent/1.1")
        }
        return try {
            if (connection.responseCode != 200) null
            else connection.inputStream.bufferedReader().use { it.readText() }
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun notify(context: Context, title: String, body: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(NotificationChannel(CHANNEL, "每日估值", NotificationManager.IMPORTANCE_LOW))
        }
        val open = PendingIntent.getActivity(
            context,
            title.hashCode(),
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(context, CHANNEL) else Notification.Builder(context)
        nm.notify(
            91,
            builder.setSmallIcon(R.drawable.ic_launcher).setContentTitle(title).setContentText(body).setAutoCancel(true).setContentIntent(open).build()
        )
    }
}

class QuoteReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        QuoteSync.refreshNow(context)
    }
}
