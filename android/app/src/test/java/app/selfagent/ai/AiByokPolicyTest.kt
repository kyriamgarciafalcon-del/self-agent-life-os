package app.selfagent.ai

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import java.net.InetAddress
import org.junit.Test

class AiByokPolicyTest {
    @Test
    fun rejectsResolvedPrivateAndLoopbackAddresses() {
        assertTrue(AiChatProtocol.isPrivateOrLocalAddress(InetAddress.getByName("127.0.0.1")))
        assertTrue(AiChatProtocol.isPrivateOrLocalAddress(InetAddress.getByName("192.168.1.2")))
        assertFalse(AiChatProtocol.isPrivateOrLocalAddress(InetAddress.getByName("8.8.8.8")))
    }

    @Test
    fun rejectsLocalhostPrivateAndLinkLocalHttpsHosts() {
        assertNull(AiChatProtocol.completionsUrl("https://localhost/v1"))
        assertNull(AiChatProtocol.completionsUrl("https://127.0.0.1/v1"))
        assertNull(AiChatProtocol.completionsUrl("https://10.1.2.3/v1"))
        assertNull(AiChatProtocol.completionsUrl("https://192.168.0.12/v1"))
        assertNull(AiChatProtocol.completionsUrl("https://172.16.4.8/v1"))
        assertNull(AiChatProtocol.completionsUrl("https://169.254.10.10/v1"))
        assertNull(AiChatProtocol.completionsUrl("https://[::1]/v1"))
        assertNull(AiChatProtocol.completionsUrl("https://[fe80::1]/v1"))
        assertNull(AiChatProtocol.completionsUrl("https://[::ffff:127.0.0.1]/v1"))
        assertNull(AiChatProtocol.completionsUrl("https://[::ffff:c0a8:1]/v1"))
        assertEquals(
            "https://api.openai.com/v1/chat/completions",
            AiChatProtocol.completionsUrl("https://api.openai.com/v1"),
        )
    }

    @Test
    fun treatsAnyRedirectAsUnusual() {
        assertFalse(AiChatProtocol.redirectAllowed("https://api.openai.com/v1", "https://api.openai.com/v2"))
        assertFalse(AiChatProtocol.redirectAllowed("https://api.openai.com/v1", "https://evil.example/v1"))
    }

    @Test
    fun connectionTestRequiresConfirmedPublicHttpsHost() {
        val ok = AiChatProtocol.connectionTest("https://api.openai.com/v1", "api.openai.com")
        assertTrue(ok.ok)
        assertEquals("api.openai.com", ok.host)
        assertFalse(AiChatProtocol.connectionTest("https://api.openai.com/v1", "evil.example").ok)
        assertFalse(AiChatProtocol.connectionTest("https://127.0.0.1/v1", "127.0.0.1").ok)
    }

    @Test(expected = IllegalArgumentException::class)
    fun requestJsonRejectsTheWholeRequestWhenModelBoundFieldsContainSecrets() {
        val incoming = org.json.JSONObject()
            .put("model", "gpt-4o-mini")
            .put("max_tokens", 99999)
            .put("messages", org.json.JSONArray().put(
                org.json.JSONObject().put("role", "user").put("content", "password: hunter2"),
            ))
        AiChatProtocol.requestJson(incoming)
    }

    @Test
    fun callBudgetRejectsAfterMaxCallsOrTokens() {
        val budget = AiChatProtocol.CallBudget(maxCalls = 1, maxTokens = 32)
        assertTrue(AiChatProtocol.consumeBudget(budget, 16))
        assertFalse(AiChatProtocol.consumeBudget(budget, 1))
    }
}
