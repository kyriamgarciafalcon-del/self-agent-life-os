package app.selfagent.ledger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class PayParserTest {
    @Test
    fun `promotion and nearby collection label do not create a payment draft`() {
        val parsed = PayParser.parse(
            pkg = "com.tencent.mm",
            raw = "微信首页 收款 签到领京豆，每天赚10块，放弃，去领取 ¥10.00",
            at = 1_800_000L,
            channel = "accessibility",
        )

        assertNull(parsed)
    }

    @Test
    fun `generic collection label with an amount is not a completed payment`() {
        val parsed = PayParser.parse(
            pkg = "com.tencent.mm",
            raw = "微信首页 收款 ¥10.00",
            at = 1_800_000L,
            channel = "accessibility",
        )

        assertNull(parsed)
    }

    @Test
    fun `wechat outgoing transfer card is recognized as an expense`() {
        val parsed = PayParser.parse(
            pkg = "com.tencent.mm",
            raw = "¥0.01 你发起了一笔转账 转账",
            at = 1_800_000L,
            channel = "accessibility",
        )

        assertNotNull(parsed)
        assertEquals(0.01, parsed?.amount ?: 0.0, 0.001)
        assertEquals("out", parsed?.dir)
    }

    @Test
    fun `explicit successful payment is still recognized`() {
        val parsed = PayParser.parse(
            pkg = "com.tencent.mm",
            raw = "微信支付成功，向星巴克付款 ¥18.50",
            at = 1_800_000L,
            channel = "notification",
        )

        assertEquals(18.50, parsed?.amount ?: 0.0, 0.001)
        assertEquals("out", parsed?.dir)
        assertEquals("星巴克", parsed?.title)
    }
}
