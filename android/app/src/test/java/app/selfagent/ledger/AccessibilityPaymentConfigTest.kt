package app.selfagent.ledger

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class AccessibilityPaymentConfigTest {
    @Test
    fun `payment accessibility service receives text changes and scrolls`() {
        val config = File("app/src/main/res/xml/pay_accessibility.xml")
        assertTrue("payment accessibility config must exist at ${config.absolutePath}", config.isFile)
        val xml = config.readText()

        assertTrue(xml.contains("typeViewTextChanged"))
        assertTrue(xml.contains("typeViewScrolled"))
    }
}
