package app.selfagent.ai

import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.util.Locale
import java.util.regex.Pattern

object AiChatProtocol {
    const val EVENT_VERSION = 1
    const val CONFIG_EVENT = "self-agent:ai-config"
    const val REPLY_EVENT = "self-agent:ai-reply"
    const val DEFAULT_MODEL = "gpt-4o-mini"
    const val MAX_TOKENS = 1024
    const val REDACTED = "[REDACTED]"

    private val SENSITIVE_PATTERNS: List<Pattern> = listOf(
        Pattern.compile("(?i)(?:密码|口令|password|passwd)\\s*[:=是为]?\\s*\\S+"),
        Pattern.compile("(?i)(?:api[_-]?key|API密钥)\\s*[:=是为]?\\s*\\S+"),
        Pattern.compile("\\bsk-[A-Za-z0-9_-]{8,}\\b"),
        Pattern.compile("(?i)(?:token|令牌)\\s*[:=是为]?\\s*\\S+"),
        Pattern.compile("\\bghp_[A-Za-z0-9]{16,}\\b"),
        Pattern.compile("(?i)(?:验证码|otp|one[-\\s]?time(?:\\s*password)?)\\s*[:=是为]?\\s*\\d{4,8}"),
        Pattern.compile("-----BEGIN [A-Z ]*PRIVATE KEY-----[\\s\\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
        Pattern.compile("私钥(?:\\s+BEGIN PRIVATE KEY)?"),
        Pattern.compile("BEGIN PRIVATE KEY"),
        Pattern.compile("助记词[\\s\\S]{0,120}"),
        Pattern.compile("(?i)(?:mnemonic|seed phrase)\\s*[:=]?\\s*(?:[a-z]+(?:\\s+|$)){8,24}"),
        Pattern.compile("\\b(?:\\d[ -]*?){13,19}\\b"),
    )

    data class ConnectionTest(val ok: Boolean, val host: String, val reason: String? = null)

    class CallBudget(val maxCalls: Int, val maxTokens: Int) {
        var remainingCalls: Int = maxCalls
        var remainingTokens: Int = maxTokens
    }

    fun normalizeBaseUrl(raw: String): String = raw.trim().trimEnd('/')

    fun hostOf(raw: String): String {
        val candidate = if (raw.contains("://")) raw else "https://$raw"
        return runCatching { URI(candidate).host.orEmpty().trim('[', ']') }.getOrDefault("")
    }

    fun isPrivateOrLocalHost(host: String): Boolean {
        val h = host.trim().trim('[', ']').lowercase(Locale.US)
        if (h.isBlank() || h == "localhost" || h.endsWith(".localhost") || h == "::1") return true
        if (h.contains(":") && (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd"))) return true
        val parts = h.split('.')
        if (parts.size == 4 && parts.all { it.toIntOrNull() != null }) {
            val a = parts[0].toInt()
            val b = parts[1].toInt()
            if (a == 0 || a == 10 || a == 127) return true
            if (a == 192 && b == 168) return true
            if (a == 172 && b in 16..31) return true
            if (a == 169 && b == 254) return true
        }
        return false
    }

    fun completionsUrl(baseUrl: String): String? {
        val normalized = normalizeBaseUrl(baseUrl)
        if (!normalized.lowercase(Locale.US).startsWith("https://")) return null
        val host = hostOf(normalized)
        if (isPrivateOrLocalHost(host)) return null
        return if (normalized.endsWith("/chat/completions")) normalized else "$normalized/chat/completions"
    }

    fun redirectAllowed(@Suppress("UNUSED_PARAMETER") from: String, @Suppress("UNUSED_PARAMETER") to: String): Boolean = false

    fun connectionTest(baseUrl: String, confirmedHost: String): ConnectionTest {
        val host = hostOf(baseUrl)
        val url = completionsUrl(baseUrl)
        if (url == null) return ConnectionTest(ok = false, host = host, reason = "invalid_target")
        if (host != confirmedHost.trim()) return ConnectionTest(ok = false, host = host, reason = "host_mismatch")
        return ConnectionTest(ok = true, host = host)
    }

    fun consumeBudget(budget: CallBudget, tokens: Int): Boolean {
        if (budget.remainingCalls < 1 || tokens > budget.remainingTokens) return false
        budget.remainingCalls -= 1
        budget.remainingTokens -= tokens
        return true
    }

    fun redactSensitive(text: String): String {
        var next = text
        for (pattern in SENSITIVE_PATTERNS) {
            next = pattern.matcher(next).replaceAll(REDACTED)
        }
        return next
    }

    fun requestJson(incoming: JSONObject): JSONObject {
        val model = incoming.optString("model").ifBlank { DEFAULT_MODEL }
        val messages = incoming.optJSONArray("messages") ?: JSONArray()
        val cleaned = JSONArray()
        for (index in 0 until minOf(messages.length(), 24)) {
            val item = messages.optJSONObject(index) ?: continue
            val role = item.optString("role")
            if (role !in setOf("system", "user", "assistant")) continue
            val content = redactSensitive(item.optString("content")).take(32_000)
            if (content.isBlank()) continue
            cleaned.put(
                JSONObject()
                    .put("role", role)
                    .put("content", content),
            )
        }
        val requested = incoming.optInt("max_tokens", MAX_TOKENS)
        val maxTokens = if (requested in 1..MAX_TOKENS) requested else MAX_TOKENS
        return JSONObject()
            .put("model", model)
            .put("max_tokens", maxTokens)
            .put("messages", cleaned)
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
