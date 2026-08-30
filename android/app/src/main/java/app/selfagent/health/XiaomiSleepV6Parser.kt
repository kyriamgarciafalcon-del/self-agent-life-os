package app.selfagent.health

data class XiaomiSleepV6Summary(
    val bedEpochSeconds: Long,
    val wakeEpochSeconds: Long,
    val totalMinutes: Int,
    val wakeMinutes: Int,
    val lightMinutes: Int,
    val remMinutes: Int,
    val deepMinutes: Int,
)

class XiaomiSleepV6Parser {
    fun parse(bytes: ByteArray): XiaomiSleepV6Summary? {
        if (bytes.size < HEADER_SIZE) return null
        val bed = u32le(bytes, 12)
        val wake = u32le(bytes, 16)
        if (bed <= 0L || wake <= 0L) return null
        var latest: Type16? = null
        var i = 0
        while (i <= bytes.size - PACKET_HEADER) {
            if (!isMagic(bytes, i)) {
                i++
                continue
            }
            val dataLen = u16be(bytes, i + 15)
            val payloadStart = i + PACKET_HEADER
            if (payloadStart + dataLen > bytes.size) {
                i++
                continue
            }
            val type = u8(bytes[i + 14])
            if (type == TYPE_SLEEP_SUMMARY && dataLen >= TYPE16_MIN_PAYLOAD) {
                latest = Type16(
                    total = u16be(bytes, payloadStart + 1),
                    wake = u16be(bytes, payloadStart + 3),
                    light = u16be(bytes, payloadStart + 5),
                    rem = u16be(bytes, payloadStart + 7),
                    deep = u16be(bytes, payloadStart + 9),
                )
            }
            i = payloadStart + dataLen
        }
        val stages = latest ?: return null
        return XiaomiSleepV6Summary(
            bedEpochSeconds = bed,
            wakeEpochSeconds = wake,
            totalMinutes = stages.total,
            wakeMinutes = stages.wake,
            lightMinutes = stages.light,
            remMinutes = stages.rem,
            deepMinutes = stages.deep,
        )
    }

    private data class Type16(
        val total: Int,
        val wake: Int,
        val light: Int,
        val rem: Int,
        val deep: Int,
    )

    companion object {
        private const val HEADER_SIZE = 20
        private const val PACKET_HEADER = 17
        private const val TYPE_SLEEP_SUMMARY = 16
        private const val TYPE16_MIN_PAYLOAD = 11

        private fun isMagic(bytes: ByteArray, offset: Int): Boolean =
            u8(bytes[offset]) == 0xFB &&
                u8(bytes[offset + 1]) == 0xFA &&
                u8(bytes[offset + 2]) == 0xFC &&
                u8(bytes[offset + 3]) == 0xFF

        private fun u8(b: Byte): Int = b.toInt() and 0xFF

        private fun u16be(bytes: ByteArray, offset: Int): Int =
            (u8(bytes[offset]) shl 8) or u8(bytes[offset + 1])

        private fun u32le(bytes: ByteArray, offset: Int): Long =
            u8(bytes[offset]).toLong() or
                (u8(bytes[offset + 1]).toLong() shl 8) or
                (u8(bytes[offset + 2]).toLong() shl 16) or
                (u8(bytes[offset + 3]).toLong() shl 24)
    }
}
