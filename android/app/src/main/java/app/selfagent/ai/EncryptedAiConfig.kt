package app.selfagent.ai

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

object EncryptedAiConfig {
    private const val PREFS = "self_agent_ai"
    private const val META = "meta"
    private const val BLOB = "api_key_blob"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val ALIAS = "self_agent_ai_aes"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"

    fun publicJson(context: Context): JSONObject {
        val meta = loadMeta(context)
        return AiChatProtocol.configEvent(
            meta.optString("baseUrl"),
            meta.optString("model"),
            !loadKey(context).isNullOrBlank(),
        )
    }

    fun save(context: Context, raw: String): JSONObject {
        val incoming = runCatching { JSONObject(raw) }.getOrDefault(JSONObject())
        val baseUrl = AiChatProtocol.normalizeBaseUrl(incoming.optString("baseUrl"))
        val model = incoming.optString("model").ifBlank { AiChatProtocol.DEFAULT_MODEL }
        val incomingKey = AiChatProtocol.extractApiKey(incoming)
        persistMeta(context, baseUrl, model)
        if (incomingKey.isNotBlank()) persistKey(context, incomingKey)
        val hasKey = incomingKey.isNotBlank() || !loadKey(context).isNullOrBlank()
        return AiChatProtocol.configEvent(baseUrl, model, hasKey)
    }

    fun clear(context: Context): JSONObject {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
        return AiChatProtocol.configEvent("", AiChatProtocol.DEFAULT_MODEL, false)
    }

    data class RequestTarget(val url: String, val model: String, val apiKey: String)

    fun requestTarget(context: Context): RequestTarget? {
        val meta = loadMeta(context)
        val url = AiChatProtocol.completionsUrl(meta.optString("baseUrl")) ?: return null
        val key = loadKey(context)?.trim().orEmpty()
        if (key.isBlank()) return null
        val model = meta.optString("model").ifBlank { AiChatProtocol.DEFAULT_MODEL }
        return RequestTarget(url, model, key)
    }

    private fun loadMeta(context: Context): JSONObject {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(META, null) ?: return JSONObject()
        return runCatching { JSONObject(raw) }.getOrDefault(JSONObject())
    }

    private fun persistMeta(context: Context, baseUrl: String, model: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(META, JSONObject().put("baseUrl", baseUrl).put("model", model).toString())
            .apply()
    }

    private fun loadKey(context: Context): String? {
        val encoded = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(BLOB, null) ?: return null
        return try {
            String(decrypt(encoded), Charsets.UTF_8)
        } catch (_: Exception) {
            null
        }
    }

    private fun persistKey(context: Context, apiKey: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(BLOB, encrypt(apiKey.toByteArray(Charsets.UTF_8)))
            .apply()
    }

    private fun secretKey(): SecretKey {
        val store = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        (store.getKey(ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private fun encrypt(plain: ByteArray): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val iv = cipher.iv
        val encrypted = cipher.doFinal(plain)
        val out = ByteArray(1 + iv.size + encrypted.size)
        out[0] = iv.size.toByte()
        System.arraycopy(iv, 0, out, 1, iv.size)
        System.arraycopy(encrypted, 0, out, 1 + iv.size, encrypted.size)
        return Base64.encodeToString(out, Base64.NO_WRAP)
    }

    private fun decrypt(encoded: String): ByteArray {
        val packed = Base64.decode(encoded, Base64.NO_WRAP)
        val ivSize = packed[0].toInt()
        val iv = packed.copyOfRange(1, 1 + ivSize)
        val cipherBytes = packed.copyOfRange(1 + ivSize, packed.size)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
        return cipher.doFinal(cipherBytes)
    }
}
