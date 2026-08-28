package app.selfagent.vault

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONArray
import org.json.JSONObject
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class VaultEntry(
    val id: String,
    val app: String,
    val title: String,
    val username: String,
    val password: String,
)

object EncryptedVault {
    private const val PREFS = "self_agent_vault"
    private const val BLOB = "blob"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val ALIAS = "self_agent_vault_aes"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"

    fun listMeta(context: Context): JSONArray {
        val out = JSONArray()
        for (entry in load(context)) {
            out.put(
                JSONObject()
                    .put("id", entry.id)
                    .put("app", entry.app)
                    .put("title", entry.title)
                    .put("usernameHint", if (entry.username.isBlank()) "已保存" else "账号已保存")
                    .put("hasPassword", entry.password.isNotBlank())
            )
        }
        return out
    }

    fun findForPackage(context: Context, pkg: String, webDomain: String? = null): VaultEntry? {
        val items = load(context)
        if (!webDomain.isNullOrBlank()) {
            items.firstOrNull { it.app.equals("web:$webDomain", true) }?.let { return it }
        }
        return items.firstOrNull { it.app == pkg }
    }

    fun save(context: Context, app: String, username: String, password: String) {
        val items = load(context).toMutableList()
        val existing = items.indexOfFirst { it.app == app && it.username == username }
        val entry = VaultEntry(
            id = if (existing >= 0) items[existing].id else UUID.randomUUID().toString(),
            app = app,
            title = if (app.startsWith("web:")) app.removePrefix("web:") else app.substringAfterLast('.').ifBlank { app },
            username = username,
            password = password,
        )
        if (existing >= 0) items[existing] = entry else items.add(0, entry)
        persist(context, items)
    }

    private fun load(context: Context): List<VaultEntry> {
        val encoded = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(BLOB, null)
            ?: return emptyList()
        return try {
            val json = JSONArray(String(decrypt(encoded), Charsets.UTF_8))
            buildList {
                for (i in 0 until json.length()) {
                    val obj = json.getJSONObject(i)
                    add(
                        VaultEntry(
                            id = obj.optString("id", UUID.randomUUID().toString()),
                            app = obj.optString("app"),
                            title = obj.optString("title", obj.optString("app")),
                            username = obj.optString("username"),
                            password = obj.optString("password"),
                        )
                    )
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun persist(context: Context, items: List<VaultEntry>) {
        val json = JSONArray()
        items.forEach { item ->
            json.put(
                JSONObject()
                    .put("id", item.id)
                    .put("app", item.app)
                    .put("title", item.title)
                    .put("username", item.username)
                    .put("password", item.password)
            )
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(BLOB, encrypt(json.toString().toByteArray(Charsets.UTF_8)))
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
                .build()
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
