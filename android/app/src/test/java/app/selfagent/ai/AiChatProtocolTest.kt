package app.selfagent.ai

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AiChatProtocolTest {
    @Test
    fun completionsUrlRequiresHttpsAndAppendsChatCompletions() {
        assertEquals(
            "https://api.openai.com/v1/chat/completions",
            AiChatProtocol.completionsUrl("https://api.openai.com/v1/"),
        )
        assertEquals(
            "https://api.openai.com/v1/chat/completions",
            AiChatProtocol.completionsUrl("https://api.openai.com/v1/chat/completions"),
        )
        assertNull(AiChatProtocol.completionsUrl("http://api.openai.com/v1"))
        assertNull(AiChatProtocol.completionsUrl("ftp://api.openai.com/v1"))
        assertNull(AiChatProtocol.completionsUrl(""))
    }

    @Test
    fun requestJsonKeepsOnlyModelAndMessagesAndDropsVaultFields() {
        val incoming = JSONObject()
            .put("apiKey", "sk-secret")
            .put("password", "hunter2")
            .put("vaultItems", JSONArray().put(JSONObject().put("password", "vault-secret")))
            .put("model", "gpt-4o-mini")
            .put("messages", JSONArray().put(JSONObject().put("role", "user").put("content", "hello")))
        val body = AiChatProtocol.requestJson(incoming)
        assertEquals("gpt-4o-mini", body.getString("model"))
        assertEquals(1, body.getJSONArray("messages").length())
        assertFalse(body.toString().contains("sk-secret"))
        assertFalse(body.toString().contains("hunter2"))
        assertFalse(body.toString().contains("vault"))
        assertFalse(body.has("apiKey"))
        assertFalse(body.has("password"))
        assertFalse(body.has("vaultItems"))
    }

    @Test
    fun versionedEventsNeverIncludeSecrets() {
        val config = AiChatProtocol.configEvent("https://api.openai.com/v1", "gpt-4o-mini", true)
        val reply = AiChatProtocol.replyEvent("r1", "你好")
        val error = AiChatProtocol.errorEvent("r1", "timeout")
        assertEquals(1, config.getInt("v"))
        assertEquals(1, reply.getInt("v"))
        assertEquals(1, error.getInt("v"))
        assertTrue(config.getBoolean("configured"))
        assertTrue(config.getBoolean("hasKey"))
        assertFalse(config.has("apiKey"))
        assertFalse(config.toString().contains("password"))
        assertFalse(reply.has("apiKey"))
        assertEquals("r1", error.getString("requestId"))
        assertFalse(error.getBoolean("ok"))
    }

    @Test
    fun parseAssistantContentReadsChatCompletionsMessage() {
        val body = """{"choices":[{"message":{"content":"草稿已准备"}}]}"""
        assertEquals("草稿已准备", AiChatProtocol.parseAssistantContent(body))
        assertNull(AiChatProtocol.parseAssistantContent("{}"))
    }

    @Test
    fun publicConfigIgnoresVaultAndPasswordKeys() {
        val saved = AiChatProtocol.publicConfig(
            JSONObject()
                .put("baseUrl", "https://api.openai.com/v1/")
                .put("model", "")
                .put("apiKey", "sk-secret")
                .put("password", "nope")
                .put("vaultItems", JSONArray()),
            hasKey = true,
        )
        assertEquals("https://api.openai.com/v1", saved.getString("baseUrl"))
        assertEquals("gpt-4o-mini", saved.getString("model"))
        assertTrue(saved.getBoolean("hasKey"))
        assertFalse(saved.has("apiKey"))
        assertFalse(saved.has("password"))
        assertFalse(saved.has("vaultItems"))
    }
}
