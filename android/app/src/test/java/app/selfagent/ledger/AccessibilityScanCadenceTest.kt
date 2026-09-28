package app.selfagent.ledger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class AccessibilityScanCadenceTest {
    @Test
    fun `events inside the scan interval keep a trailing scan queued`() {
        val type = runCatching {
            Class.forName("app.selfagent.ledger.AccessibilityScanCadence")
        }.getOrNull()
        assertNotNull("accessibility scan cadence must schedule, not drop, events", type)
        val cadence = type!!.getConstructor().newInstance()
        val delayUntilNextScan = type.getMethod("delayUntilNextScan", java.lang.Long.TYPE)
        val markScanned = type.getMethod("markScanned", java.lang.Long.TYPE)
        fun delay(now: Long) = delayUntilNextScan.invoke(cadence, now) as Long

        assertEquals(80L, delay(1_000L))
        markScanned.invoke(cadence, 1_000L)
        assertEquals(300L, delay(1_100L))
        assertEquals(200L, delay(1_200L))
        assertEquals(80L, delay(1_400L))
    }
}
