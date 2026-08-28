package app.selfagent.vault

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import app.selfagent.MainActivity

class VaultSettingsActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 72, 48, 48)
        }
        root.addView(TextView(this).apply {
            text = "Self Agent 密码库"
            textSize = 22f
        })
        root.addView(TextView(this).apply {
            text = "凭据使用 Android Keystore 加密保存在本机。自动填充需要你在系统设置中把服务选为 Self Agent。"
            textSize = 14f
            setPadding(0, 24, 0, 32)
        })
        root.addView(Button(this).apply {
            text = "打开系统自动填充设置"
            setOnClickListener {
                startActivity(Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE).setData(android.net.Uri.parse("package:$packageName")))
            }
        })
        root.addView(Button(this).apply {
            text = "返回应用"
            setOnClickListener {
                startActivity(Intent(this@VaultSettingsActivity, MainActivity::class.java))
                finish()
            }
        })
        setContentView(root)
    }
}
