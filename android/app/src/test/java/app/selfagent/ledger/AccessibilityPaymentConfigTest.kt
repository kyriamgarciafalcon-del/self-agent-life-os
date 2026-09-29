package app.selfagent.ledger

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class AccessibilityPaymentConfigTest {
    @Test
    fun `payment accessibility service receives text changes and scrolls`() {
        val config = sequenceOf(
            File("app/src/main/res/xml/pay_accessibility.xml"),
            File("android/app/src/main/res/xml/pay_accessibility.xml"),
            File("src/main/res/xml/pay_accessibility.xml"),
        ).firstOrNull { it.isFile }
        assertTrue("payment accessibility config must be discoverable from ${File(".").absolutePath}", config != null)
        val xml = requireNotNull(config).readText()

        assertTrue(xml.contains("typeViewTextChanged"))
        assertTrue(xml.contains("typeViewScrolled"))
    }
}
