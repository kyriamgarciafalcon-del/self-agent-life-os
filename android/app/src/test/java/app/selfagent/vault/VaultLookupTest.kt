package app.selfagent.vault

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VaultLookupTest {
    private val items = listOf(
        VaultEntry(id = "a1", app = "web:bank.com", title = "bank.com", username = "me", password = "secret"),
        VaultEntry(id = "b2", app = "com.tencent.mm", title = "mm", username = "wx", password = "p"),
    )

    @Test
    fun findsById() {
        assertEquals("secret", EncryptedVault.match(items, "a1")?.password)
    }

    @Test
    fun findsByTitleWhenIdMissing() {
        assertEquals("p", EncryptedVault.match(items, "mm")?.password)
    }

    @Test
    fun returnsNullWhenUnknown() {
        assertNull(EncryptedVault.match(items, "missing"))
    }
}
