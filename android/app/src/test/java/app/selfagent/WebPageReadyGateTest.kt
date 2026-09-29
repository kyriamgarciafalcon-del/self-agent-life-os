package app.selfagent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class WebPageReadyGateTest {
    @Test
    fun `native event waits until the WebView client is ready`() {
        val gateType = runCatching { Class.forName("app.selfagent.WebPageReadyGate") }.getOrNull()
        assertNotNull("native-to-WebView readiness gate is missing", gateType)
        if (gateType == null) return
        val gate = gateType.getDeclaredConstructor().newInstance()
        val dispatch = gateType.getMethod("dispatch", Runnable::class.java)
        val markReady = gateType.getMethod("markReady")
        val delivered = mutableListOf<String>()

        dispatch.invoke(gate, Runnable { delivered += "payment" })
        assertEquals(emptyList<String>(), delivered)

        markReady.invoke(gate)
        assertEquals(listOf("payment"), delivered)
    }

    @Test
    fun `native event is delivered immediately after readiness`() {
        val gateType = runCatching { Class.forName("app.selfagent.WebPageReadyGate") }.getOrNull()
        assertNotNull("native-to-WebView readiness gate is missing", gateType)
        if (gateType == null) return
        val gate = gateType.getDeclaredConstructor().newInstance()
        val dispatch = gateType.getMethod("dispatch", Runnable::class.java)
        val markReady = gateType.getMethod("markReady")
        val delivered = mutableListOf<String>()

        markReady.invoke(gate)
        dispatch.invoke(gate, Runnable { delivered += "payment" })
        assertEquals(listOf("payment"), delivered)
    }
}
