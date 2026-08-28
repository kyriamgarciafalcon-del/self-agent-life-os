package app.selfagent

import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.provider.Settings
import android.view.autofill.AutofillManager
import app.selfagent.ledger.PayAccessibilityService
import app.selfagent.vault.SelfAgentAutofillService
import org.json.JSONObject

object CapabilityStatus {
    fun json(context: Context): String {
        val accessibility = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
            ?.split(':')
            ?.any { it.contains(PayAccessibilityService::class.java.name) || it.contains(".PayAccessibilityService") }
            ?: false
        val listener = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners")
            ?.contains(context.packageName) == true
        val autofillSetting = Settings.Secure.getString(context.contentResolver, "autofill_service").orEmpty()
        val autofill = autofillSetting.contains(context.packageName) &&
            (autofillSetting.contains(SelfAgentAutofillService::class.java.name) || autofillSetting.contains(".SelfAgentAutofillService"))
        val supported = try {
            context.getSystemService(AutofillManager::class.java)?.isAutofillSupported != false
        } catch (_: Exception) { true }
        val notifications = if (Build.VERSION.SDK_INT >= 24) {
            (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).areNotificationsEnabled()
        } else true
        return JSONObject()
            .put("accessibility", accessibility)
            .put("notificationListener", listener)
            .put("autofill", autofill && supported)
            .put("notifications", notifications)
            .toString()
    }
}
