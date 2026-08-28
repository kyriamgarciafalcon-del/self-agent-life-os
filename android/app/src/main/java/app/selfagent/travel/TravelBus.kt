package app.selfagent.travel

import org.json.JSONObject
import java.util.concurrent.ConcurrentLinkedQueue

object TravelBus {
    val pending = ConcurrentLinkedQueue<JSONObject>()
    @Volatile var sink: ((JSONObject) -> Unit)? = null

    fun post(trip: PendingTrip) {
        val json = TravelParser.toJson(trip)
        val current = sink
        if (current != null) current(json) else pending.add(json)
    }
}
