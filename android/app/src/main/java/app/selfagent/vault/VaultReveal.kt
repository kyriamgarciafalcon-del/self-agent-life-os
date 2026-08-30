package app.selfagent.vault

import android.app.Activity
import android.app.AlertDialog
import android.app.KeyguardManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.hardware.biometrics.BiometricManager
import android.hardware.biometrics.BiometricPrompt
import android.os.Build
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.os.PersistableBundle
import android.view.WindowManager
import android.widget.Toast
import java.util.concurrent.Executor

object VaultReveal {
    const val REQUEST_CREDENTIAL = 83
    @Volatile var pendingId: String? = null

    fun start(activity: Activity, id: String) {
        val entry = EncryptedVault.findById(activity, id)
        if (entry == null) {
            Toast.makeText(activity, "没有找到这条密码", Toast.LENGTH_SHORT).show()
            return
        }
        pendingId = entry.id
        authenticate(activity, entry)
    }

    fun onCredentialResult(activity: Activity, ok: Boolean) {
        val id = pendingId
        pendingId = null
        if (!ok || id == null) return
        EncryptedVault.findById(activity, id)?.let { show(activity, it) }
    }

    private fun authenticate(activity: Activity, entry: VaultEntry) {
        if (Build.VERSION.SDK_INT >= 28) {
            val handler = Handler(Looper.getMainLooper())
            val executor = Executor { handler.post(it) }
            val builder = BiometricPrompt.Builder(activity)
                .setTitle("查看密码")
                .setSubtitle(entry.title)
                .setDescription("验证指纹或锁屏密码后显示明文")
            if (Build.VERSION.SDK_INT >= 30) {
                builder.setAllowedAuthenticators(
                    BiometricManager.Authenticators.BIOMETRIC_STRONG or
                        BiometricManager.Authenticators.DEVICE_CREDENTIAL
                )
            } else {
                builder.setNegativeButton("取消", executor) { _, _ -> pendingId = null }
            }
            builder.build().authenticate(
                CancellationSignal(),
                executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult?) {
                        activity.runOnUiThread { show(activity, entry) }
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence?) {
                        if (errorCode == BiometricPrompt.BIOMETRIC_ERROR_NO_BIOMETRICS ||
                            errorCode == BiometricPrompt.BIOMETRIC_ERROR_HW_UNAVAILABLE
                        ) {
                            activity.runOnUiThread { confirmDeviceCredential(activity, entry) }
                        }
                    }
                }
            )
            return
        }
        confirmDeviceCredential(activity, entry)
    }

    private fun confirmDeviceCredential(activity: Activity, entry: VaultEntry) {
        val keyguard = activity.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        if (!keyguard.isKeyguardSecure) {
            Toast.makeText(activity, "请先设置手机锁屏或指纹", Toast.LENGTH_LONG).show()
            return
        }
        pendingId = entry.id
        @Suppress("DEPRECATION")
        val intent = keyguard.createConfirmDeviceCredentialIntent("查看密码", entry.title)
        if (intent == null) {
            Toast.makeText(activity, "无法打开系统验证", Toast.LENGTH_SHORT).show()
            return
        }
        activity.startActivityForResult(intent, REQUEST_CREDENTIAL)
    }

    private fun show(activity: Activity, entry: VaultEntry) {
        pendingId = null
        val text = "账号：${entry.username.ifBlank { "未填写" }}\n密码：${entry.password}"
        AlertDialog.Builder(activity)
            .setTitle(entry.title)
            .setMessage(text)
            .setPositiveButton("复制密码") { _, _ ->
                val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val copied = entry.password
                val clip = ClipData.newPlainText("password", copied)
                clip.description.extras = PersistableBundle().apply {
                    putBoolean("android.content.extra.IS_SENSITIVE", true)
                }
                clipboard.setPrimaryClip(clip)
                Handler(Looper.getMainLooper()).postDelayed({
                    val current = clipboard.primaryClip
                        ?.takeIf { it.itemCount > 0 }
                        ?.getItemAt(0)
                        ?.coerceToText(activity)
                        ?.toString()
                    if (current == copied) {
                        if (Build.VERSION.SDK_INT >= 28) clipboard.clearPrimaryClip()
                        else clipboard.setPrimaryClip(ClipData.newPlainText("", ""))
                    }
                }, 45_000L)
                Toast.makeText(activity, "密码已复制，45 秒后自动清除", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("关闭", null)
            .show()
            .window
            ?.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
    }
}
