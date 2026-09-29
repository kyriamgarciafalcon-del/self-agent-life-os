package app.selfagent

import java.util.ArrayDeque

/** Holds native-to-WebView events until the React event listeners are installed. */
class WebPageReadyGate {
    private val lock = Any()
    private val pending = ArrayDeque<Runnable>()
    private var ready = false

    fun dispatch(action: Runnable) {
        val runNow = synchronized(lock) {
            if (ready) true else {
                pending.addLast(action)
                false
            }
        }
        if (runNow) action.run()
    }

    fun markReady() {
        val queued = synchronized(lock) {
            if (ready) return
            ready = true
            buildList {
                while (pending.isNotEmpty()) add(pending.removeFirst())
            }
        }
        queued.forEach(Runnable::run)
    }

    fun isReady(): Boolean = synchronized(lock) { ready }
}