package app.selfagent.ai

import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

object AiChatProtocol {
    const val EVENT_VERSION = 1
    const val CONFIG_EVENT = "self-agent:ai-config"
    const val REPLY_EVENT = "self-agent:ai-reply"
    const val DEFAULT_MODEL = "gpt-4o-mini"

    fun normalizeBaseUrl(raw: String): String = raw.trim().trimEnd('/')

    fun completionsUrl(baseUrl: String): String? {
        val normalized = normalizeBaseUrl(baseUrl)
        if (!normalized.lowercase(Locale.US).startsWith("https://")) return null
        return if (normalized.endsWith("/chat/completions")) normalized else "$normalized/chat/completions"
    }

    fun requestJson(incoming: JSONObject): JSONObject {
        val model = incoming.optString("model").ifBlank { DEFAULT_MODEL }
        val messages = incoming.optJSONArray("messages") ?: JSONArray()
        val cleaned = JSONArray()
        for (index in 0 until minOf(messages.length(), 24)) {
            val item = messages.optJSONObject(index) ?: continue
            val role = item.optString("role")
            if (role !in setOf("system", "user", "assistant")) continue
            val content = item.optString("content").take(32_000)
            if (content.isBlank()) continue
            cleaned.put(
                JSONObject()
                    .put("role", role)
                    .put("content", content),
            )
        }
        return JSONObject().put("model", model).put("messages", cleaned)
    }

    fun configEvent(baseUrl: String, model: String, hasKey: Boolean): JSONObject {
        val url = normalizeBaseUrl(baseUrl)
        return JSONObject()
            .put("v", EVENT_VERSION)
            .put("ok", true)
            .put("baseUrl", url)
            .put("model", model.ifBlank { DEFAULT_MODEL })
            .put("hasKey", hasKey)
            .put("configured", url.isNotBlank() && hasKey)
    }

    fun replyEvent(requestId: String, content: String): JSONObject =
        JSONObject()
            .put("v", EVENT_VERSION)
            .put("ok", true)
            .put("requestId", requestId)
            .put("content", content)

    fun errorEvent(requestId: String, error: String): JSONObject =
        JSONObject()
            .put("v", EVENT_VERSION)
            .put("ok", false)
            .put("requestId", requestId)
            .put("error", error)

    fun parseAssistantContent(body: String): String? {
        val json = runCatching { JSONObject(body) }.getOrNull() ?: return null
        val content = json.optJSONArray("choices")
            ?.optJSONObject(0)
            ?.optJSONObject("message")
            ?.optString("content")
            ?.trim()
        return content?.takeIf { it.isNotEmpty() }
    }

    fun publicConfig(incoming: JSONObject, hasKey: Boolean): JSONObject {
        val baseUrl = normalizeBaseUrl(incoming.optString("baseUrl"))
        val model = incoming.optString("model").ifBlank { DEFAULT_MODEL }
        return JSONObject()
            .put("v", EVENT_VERSION)
            .put("baseUrl", baseUrl)
            .put("model", model)
            .put("hasKey", hasKey)
            .put("configured", baseUrl.isNotBlank() && hasKey)
    }

    fun extractApiKey(incoming: JSONObject): String = incoming.optString("apiKey").trim()
}
