package app.selfagent.health

import org.json.JSONObject
import java.util.concurrent.ConcurrentLinkedQueue

object HealthBus {
    val pending = ConcurrentLinkedQueue<JSONObject>()
    @Volatile var sink: ((JSONObject) -> Unit)? = null

    fun post(payload: JSONObject) {
        val current = sink
        if (current != null) current(payload) else pending.add(payload)
    }
}
