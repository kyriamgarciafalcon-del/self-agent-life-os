package app.selfagent.health

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

class XiaomiSleepV6ParserTest {
    private val parser = XiaomiSleepV6Parser()

    // Documented sample: bed 01:11, wake 07:59, total 402, wake 6, light 275, rem 63, deep 64.
    private val bedEpoch = 1_788_023_460L
    private val wakeEpoch = 1_788_047_940L

    @Test
    fun parseReturnsBedWakeAndStageDurationsFromActualSummary() {
        val bytes = sleepFile(
            bedEpoch,
            wakeEpoch,
            type16(total = 275, wake = 0, light = 172, rem = 42, deep = 61),
            type16(total = 354, wake = 3, light = 230, rem = 63, deep = 61),
            type16(total = 402, wake = 6, light = 275, rem = 63, deep = 64),
        )

        val result = parser.parse(bytes)

        assertNotNull(result)
        assertEquals(bedEpoch, result!!.bedEpochSeconds)
        assertEquals(wakeEpoch, result.wakeEpochSeconds)
        assertEquals(402, result.totalMinutes)
        assertEquals(6, result.wakeMinutes)
        assertEquals(275, result.lightMinutes)
        assertEquals(63, result.remMinutes)
        assertEquals(64, result.deepMinutes)
        val zone = ZoneId.of("Asia/Shanghai")
        val bed = Instant.ofEpochSecond(result.bedEpochSeconds).atZone(zone)
        val wake = Instant.ofEpochSecond(result.wakeEpochSeconds).atZone(zone)
        assertEquals(1, bed.hour)
        assertEquals(11, bed.minute)
        assertEquals(7, wake.hour)
        assertEquals(59, wake.minute)
    }

    @Test
    fun parseChoosesLatestType16PacketWhenSeveralArePresent() {
        val bytes = sleepFile(
            bedEpoch,
            wakeEpoch,
            type16(total = 100, wake = 1, light = 50, rem = 20, deep = 10),
            type16(total = 200, wake = 2, light = 80, rem = 30, deep = 20),
            type16(total = 402, wake = 6, light = 275, rem = 63, deep = 64),
        )

        val result = parser.parse(bytes)

        assertNotNull(result)
        assertEquals(402, result!!.totalMinutes)
        assertEquals(6, result.wakeMinutes)
        assertEquals(275, result.lightMinutes)
        assertEquals(63, result.remMinutes)
        assertEquals(64, result.deepMinutes)
    }

    @Test
    fun selectPrimarySleepKeepsLongestSessionWhenNapAppearsLaterOnSameDay() {
        val zone = ZoneId.of("Asia/Shanghai")
        val main = XiaomiSleepV6Summary(
            bedEpochSeconds = 1_788_451_740L,
            wakeEpochSeconds = 1_788_475_380L,
            totalMinutes = 394,
            wakeMinutes = 0,
            lightMinutes = 271,
            remMinutes = 89,
            deepMinutes = 34,
        )
        val nap = XiaomiSleepV6Summary(
            bedEpochSeconds = 1_788_498_480L,
            wakeEpochSeconds = 1_788_500_880L,
            totalMinutes = 40,
            wakeMinutes = 0,
            lightMinutes = 0,
            remMinutes = 0,
            deepMinutes = 0,
        )

        val selected = selectPrimarySleepByBedDate(listOf(main, nap), zone)

        assertEquals(1, selected.size)
        assertEquals(394, selected.single().totalMinutes)
        assertEquals(main.bedEpochSeconds, selected.single().bedEpochSeconds)
    }

    @Test
    fun parseReturnsNullForTruncatedOrInvalidFiles() {
        assertNull(parser.parse(ByteArray(0)))
        assertNull(parser.parse(ByteArray(19)))
        assertNull(parser.parse(sleepFile(bedEpoch, wakeEpoch)))
        assertNull(parser.parse(byteArrayOf(0xFB.toByte(), 0xFA.toByte(), 0xFC.toByte(), 0xFF.toByte(), 1, 2, 3)))
        val truncatedPacket = sleepFile(bedEpoch, wakeEpoch) +
            byteArrayOf(0xFB.toByte(), 0xFA.toByte(), 0xFC.toByte(), 0xFF.toByte()) +
            byteArrayOf(17) + le64(bedEpoch) + byteArrayOf(1, 16) + be16(13) + byteArrayOf(0x12, 0x01)
        assertNull(parser.parse(truncatedPacket))
    }

    private fun sleepFile(bed: Long, wake: Long, vararg packets: ByteArray): ByteArray {
        val header = ByteArray(7) { 0xA4.toByte() } +
            byteArrayOf(0) +
            byteArrayOf(0xDF.toByte(), 0xFF.toByte(), 0xFC.toByte()) +
            byteArrayOf(0) +
            le32(bed) +
            le32(wake)
        return packets.fold(header) { acc, packet -> acc + packet }
    }

    private fun type16(total: Int, wake: Int, light: Int, rem: Int, deep: Int, ts: Long = bedEpoch): ByteArray {
        val payload = byteArrayOf(0x12) + be16(total) + be16(wake) + be16(light) + be16(rem) + be16(deep) + byteArrayOf(0x16, 0x00)
        return byteArrayOf(0xFB.toByte(), 0xFA.toByte(), 0xFC.toByte(), 0xFF.toByte()) +
            byteArrayOf(17) +
            le64(ts) +
            byteArrayOf(1, 16) +
            be16(payload.size) +
            payload
    }

    private fun le32(value: Long): ByteArray {
        val n = value.toInt()
        return byteArrayOf(
            n.toByte(),
            (n ushr 8).toByte(),
            (n ushr 16).toByte(),
            (n ushr 24).toByte(),
        )
    }

    private fun le64(value: Long): ByteArray = byteArrayOf(
        value.toByte(),
        (value ushr 8).toByte(),
        (value ushr 16).toByte(),
        (value ushr 24).toByte(),
        (value ushr 32).toByte(),
        (value ushr 40).toByte(),
        (value ushr 48).toByte(),
        (value ushr 56).toByte(),
    )

    private fun be16(value: Int): ByteArray = byteArrayOf((value ushr 8).toByte(), value.toByte())
}
