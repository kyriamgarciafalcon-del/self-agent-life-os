package app.selfagent.travel

import org.json.JSONObject
import java.util.Calendar
import java.util.Locale
import java.util.UUID
import java.util.regex.Pattern

data class PendingTrip(
    val kind: String,
    val number: String,
    val from: String,
    val to: String,
    val departAt: String,
    val arriveAt: String,
    val seat: String,
    val terminal: String,
    val source: String,
)

object TravelParser {
    private val trainNo = Pattern.compile("([GDCZTK]\\d{1,5})次?")
    private val flightNo = Pattern.compile("(?i)\\b([A-Z]{2}\\d{3,4})\\b")
    private val routeA = Pattern.compile("([\u4e00-\u9fa5]{2,12}?)(?:站|机场)?\\s*[-—至到]\\s*([\u4e00-\u9fa5]{2,12}?)(?:站|机场)?")
    private val dateA = Pattern.compile("(?:(\\d{4})年)?(\\d{1,2})月(\\d{1,2})日")
    private val timeA = Pattern.compile("(\\d{1,2}:\\d{2})")
    private val seatA = Pattern.compile("(\\d{1,2}车\\s*\\d{1,3}[A-F]?)")
    private val gateA = Pattern.compile("检票口\\s*([A-Z]?\\d{1,3}[A-Z]?)")
    private val terminalA = Pattern.compile("(?:航站楼|登机口)\\s*([A-Z]?\\d{1,2}[A-Z]?)")

    fun looksLikeTrip(raw: String): Boolean {
        val text = raw.replace("\\s+".toRegex(), " ")
        return trainNo.matcher(text).find() ||
            (flightNo.matcher(text).find() && Regex("航班|起飞|登机|机场").containsMatchIn(text)) ||
            Regex("铁路12306|已购.*次|电子客票").containsMatchIn(text)
    }

    fun parse(raw: String, at: Long = System.currentTimeMillis()): PendingTrip? {
        val text = raw.replace("\\s+".toRegex(), " ").trim()
        if (text.isEmpty() || !looksLikeTrip(text)) return null
        val train = match(trainNo, text)
        val flight = match(flightNo, text)
        val kind = when {
            train != null -> "train"
            flight != null && Regex("航班|起飞|登机|机场").containsMatchIn(text) -> "flight"
            else -> return null
        }
        val number = (if (kind == "train") train else flight)?.uppercase(Locale.US) ?: return null
        val route = routeA.matcher(text)
        val from: String
        val to: String
        if (route.find()) {
            from = route.group(1)
            to = route.group(2)
        } else {
            from = "待确认"
            to = "待确认"
        }
        val date = parseDate(text, at)
        val times = mutableListOf<String>()
        val tm = timeA.matcher(text)
        while (tm.find()) times.add(tm.group(1))
        val depart = "$date ${times.getOrNull(0) ?: "08:00"}"
        val arrive = "$date ${times.getOrNull(1) ?: times.getOrNull(0) ?: "12:00"}"
        return PendingTrip(
            kind = kind,
            number = number,
            from = from,
            to = to,
            departAt = depart.replace(" ", "T"),
            arriveAt = arrive.replace(" ", "T"),
            seat = match(seatA, text) ?: "待分配",
            terminal = match(gateA, text) ?: match(terminalA, text) ?: "待确认",
            source = "notification",
        )
    }

    fun toJson(trip: PendingTrip): JSONObject = JSONObject()
        .put("id", "travel-${UUID.randomUUID()}")
        .put("kind", trip.kind)
        .put("number", trip.number)
        .put("from", trip.from)
        .put("to", trip.to)
        .put("departAt", trip.departAt)
        .put("arriveAt", trip.arriveAt)
        .put("seat", trip.seat)
        .put("terminal", trip.terminal)
        .put("status", "upcoming")
        .put("source", trip.source)
        .put("verified", true)

    private fun match(pattern: Pattern, text: String): String? {
        val m = pattern.matcher(text)
        return if (m.find()) m.group(1) else null
    }

    private fun parseDate(text: String, at: Long): String {
        val m = dateA.matcher(text)
        val cal = Calendar.getInstance()
        cal.timeInMillis = at
        if (m.find()) {
            val year = m.group(1)?.toIntOrNull() ?: cal.get(Calendar.YEAR)
            val month = m.group(2).toInt()
            val day = m.group(3).toInt()
            return "%04d-%02d-%02d".format(year, month, day)
        }
        return "%04d-%02d-%02d".format(cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1, cal.get(Calendar.DAY_OF_MONTH))
    }
}
