package app.selfagent.ai

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

object AiChatClient {
    private val executor = Executors.newSingleThreadExecutor()

    fun ask(context: Context, raw: String, emit: (event: String, payload: JSONObject) -> Unit) {
        val app = context.applicationContext
        executor.execute {
            val incoming = runCatching { JSONObject(raw) }.getOrDefault(JSONObject())
            val requestId = incoming.optString("requestId")
            try {
                val target = EncryptedAiConfig.requestTarget(app)
                    ?: throw IllegalStateException("unconfigured")
                if (incoming.optString("model").isBlank()) incoming.put("model", target.model)
                val body = AiChatProtocol.requestJson(incoming)
                val content = post(target.url, target.apiKey, body.toString())
                val parsed = AiChatProtocol.parseAssistantContent(content)
                    ?: throw IllegalStateException("invalid")
                emit(AiChatProtocol.REPLY_EVENT, AiChatProtocol.replyEvent(requestId, parsed))
            } catch (error: Exception) {
                emit(AiChatProtocol.REPLY_EVENT, AiChatProtocol.errorEvent(requestId, sanitize(error)))
            }
        }
    }

    private fun post(url: String, apiKey: String, body: String): String {
        val connection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 20_000
            readTimeout = 40_000
            requestMethod = "POST"
            doOutput = true
            instanceFollowRedirects = false
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer $apiKey")
            setRequestProperty("User-Agent", "SelfAgent/1.1")
        }
        return try {
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = connection.responseCode
            val stream = if (code in 200..299) connection.inputStream else connection.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (code in 200..299) text else throw IllegalStateException("http_$code")
        } finally {
            connection.disconnect()
        }
    }

    private fun sanitize(error: Exception): String {
        val message = error.message.orEmpty()
        if (message.contains("unconfigured")) return "unconfigured"
        if (message.startsWith("http_")) return "http_error"
        if (message.contains("invalid")) return "invalid"
        return "offline"
    }
}
