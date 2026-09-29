package app.selfagent.ledger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AccessibilityPaymentTextTest {
    @Test
    fun `event text is used when active window exposes no readable node text`() {
        val result = AccessibilityPaymentText.combine(
            nodeText = "",
            eventTexts = listOf("微信转账", "你发起了一笔转账", "¥ 20.00"),
            previousEventText = "",
        )

        assertTrue(result.contains("你发起了一笔转账"))
        assertTrue(result.contains("¥ 20.00"))
    }

    @Test
    fun `blank trailing accessibility event does not erase the last readable card text`() {
        val result = AccessibilityPaymentText.combine(
            nodeText = "",
            eventTexts = emptyList(),
            previousEventText = "你发起了一笔转账 ¥ 20.00",
        )

        assertEquals("你发起了一笔转账 ¥ 20.00", result)
    }

    @Test
    fun `repeated text sources are bounded and de-duplicated`() {
        val result = AccessibilityPaymentText.combine(
            nodeText = "你发起了一笔转账 ¥20",
            eventTexts = listOf("你发起了一笔转账", "¥20"),
            previousEventText = "你发起了一笔转账 ¥20",
        )

        assertEquals("你发起了一笔转账 ¥20", result)
        assertTrue(result.length <= AccessibilityPaymentText.MAX_TEXT_LENGTH)
    }
}
