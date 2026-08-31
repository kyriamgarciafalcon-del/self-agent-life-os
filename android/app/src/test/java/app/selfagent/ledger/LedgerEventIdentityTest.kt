package app.selfagent.ledger

import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class LedgerEventIdentityTest {
    @Test
    fun `different native event ids never share a guard fingerprint`() {
        val first = pending(id = "native-event-a", at = 1_800_000L)
        val second = pending(id = "native-event-b", at = 1_810_000L)

        assertNotEquals(TxnGuard.fingerprint(first), TxnGuard.fingerprint(second))
    }

    @Test
    fun `two same-channel same-amount payments ten seconds apart keep distinct parser ids`() {
        val first = PayParser.parse("com.tencent.mm", "微信支付成功 ￥18.50", 1_800_000L)
        val second = PayParser.parse("com.tencent.mm", "微信支付成功 ￥18.50", 1_810_000L)

        assertNotNull(first)
        assertNotNull(second)
        assertNotEquals(first?.id, second?.id)
    }

    @Test
    fun `same payment observed by notification and accessibility is one observation`() {
        val notification = pending(id = "notification-event", at = 1_800_000L, channel = "notification")
        val accessibility = pending(id = "accessibility-event", at = 1_805_000L, channel = "accessibility")

        org.junit.Assert.assertTrue(TxnGuard.isDuplicateObservation(notification, accessibility))
    }

    @Test
    fun `different ids from the same channel remain separate even inside the cross-channel window`() {
        val first = pending(id = "notification-event-a", at = 1_800_000L, channel = "notification")
        val second = pending(id = "notification-event-b", at = 1_805_000L, channel = "notification")

        org.junit.Assert.assertFalse(TxnGuard.isDuplicateObservation(first, second))
    }

    private fun pending(id: String, at: Long, channel: String = "unknown") = PendingTxn(
        id = id,
        amount = 18.5,
        dir = "out",
        title = "微信支付",
        source = "wechat",
        accountHint = "微信零钱/银行卡",
        category = "其他",
        raw = "微信支付成功 ￥18.50",
        at = at,
        channel = channel,
    )
}
