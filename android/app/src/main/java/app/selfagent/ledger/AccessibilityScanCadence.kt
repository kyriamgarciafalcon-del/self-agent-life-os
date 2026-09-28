package app.selfagent.ledger

internal class AccessibilityScanCadence {
    private val minimumIntervalMillis = 400L
    private val settleMillis = 80L
    private var lastScanAt = 0L

    fun delayUntilNextScan(now: Long): Long =
        maxOf(settleMillis, (lastScanAt + minimumIntervalMillis - now).coerceAtLeast(0L))

    fun markScanned(at: Long) {
        lastScanAt = at
    }
}
