package app.selfagent

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Window
import android.webkit.JavascriptInterface
import android.webkit.JsResult
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import androidx.webkit.WebViewAssetLoader
import app.selfagent.capture.CaptureController
import app.selfagent.health.HealthBus
import app.selfagent.health.HealthImportActivity
import app.selfagent.health.GadgetbridgeImportActivity
import app.selfagent.ledger.ConfirmBus
import app.selfagent.ledger.PendingTxn
import app.selfagent.quotes.QuoteBus
import app.selfagent.quotes.QuoteSync
import app.selfagent.travel.TravelBus
import app.selfagent.vault.EncryptedVault
import app.selfagent.vault.VaultReveal
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentLinkedQueue

class MainActivity : Activity() {

    companion object {
        const val EXTRA_TXN = "ledger_txn"
        const val EXTRA_AUTO_SAVE = "ledger_auto_save"
        const val LOCAL_APP_URL = "https://appassets.androidplatform.net/assets/www/index.html"
        const val LOCAL_APP_HOST = "appassets.androidplatform.net"

        fun ledgerIntent(context: Context, json: String, autoSave: Boolean): Intent =
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(EXTRA_TXN, json)
                .putExtra(EXTRA_AUTO_SAVE, autoSave)
    }

    private lateinit var webView: WebView
    private val pendingTransactions = ConcurrentLinkedQueue<PendingTxn>()
    private val pendingTravels = ConcurrentLinkedQueue<JSONObject>()
    private val pendingHealth = ConcurrentLinkedQueue<JSONObject>()
    private val pendingQuotes = ConcurrentLinkedQueue<JSONObject>()
    private val pendingCapture = ConcurrentLinkedQueue<String>()
    private lateinit var capture: CaptureController
    private var backCallback: OnBackInvokedCallback? = null
    private var pageReady = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.layoutAlgorithm = WebSettings.LayoutAlgorithm.TEXT_AUTOSIZING
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    pageReady = true
                    applyLedgerIntent(intent)
                    flushPending()
                }
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    if (uri.host == LOCAL_APP_HOST) return false
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    return true
                }
            }
            addJavascriptInterface(AndroidBridge(), "SelfAgentNative")
            webChromeClient = object : WebChromeClient() {
                override fun onJsAlert(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                    android.app.AlertDialog.Builder(this@MainActivity)
                        .setMessage(message)
                        .setPositiveButton("确定") { _, _ -> result?.confirm() }
                        .setOnCancelListener { result?.confirm() }
                        .show()
                    return true
                }
                override fun onJsConfirm(view: WebView?, url: String?, message: String?, result: JsResult?): Boolean {
                    android.app.AlertDialog.Builder(this@MainActivity)
                        .setMessage(message)
                        .setPositiveButton("确定") { _, _ -> result?.confirm() }
                        .setNegativeButton("取消") { _, _ -> result?.cancel() }
                        .setOnCancelListener { result?.cancel() }
                        .show()
                    return true
                }
            }
        }
        setContentView(webView)
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 76)
        }

        ConfirmBus.sink = { transaction ->
            pendingTransactions.add(transaction)
            runOnUiThread { flushPending() }
        }
        TravelBus.sink = { trip ->
            pendingTravels.add(trip)
            runOnUiThread { flushPending() }
        }
        HealthBus.sink = { payload ->
            pendingHealth.add(payload)
            runOnUiThread { flushPending() }
        }
        QuoteBus.sink = { payload ->
            pendingQuotes.add(payload)
            runOnUiThread { flushPending() }
        }
        capture = CaptureController(this) { text ->
            pendingCapture.add(text)
            runOnUiThread { flushPending() }
        }
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = OnBackInvokedCallback { handleWebBack() }
            onBackInvokedDispatcher.registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                backCallback!!
            )
        }
        webView.loadUrl(LOCAL_APP_URL)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (Build.VERSION.SDK_INT < 33) handleWebBack() else super.onBackPressed()
    }

    private fun handleWebBack() {
        webView.evaluateJavascript(
            "(function(){try{return !!(window.selfAgentHandleBack&&window.selfAgentHandleBack());}catch(e){return false;}})()"
        ) { raw ->
            if (raw != "true") finish()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (pageReady) applyLedgerIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        GadgetbridgeImportActivity.importSaved(this)
        if (::webView.isInitialized) flushPending()
    }

    private fun requestUnrestrictedBattery() {
        if (Build.VERSION.SDK_INT < 23) return
        val pm = getSystemService(android.os.PowerManager::class.java) ?: return
        if (pm.isIgnoringBatteryOptimizations(packageName)) return
        try {
            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).setData(Uri.parse("package:$packageName")))
        } catch (_: Exception) { /* Xiaomi may hide this screen. */ }
    }

    override fun onDestroy() {
        ConfirmBus.sink = null
        TravelBus.sink = null
        HealthBus.sink = null
        QuoteBus.sink = null
        if (::capture.isInitialized) capture.destroy()
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback?.let { onBackInvokedDispatcher.unregisterOnBackInvokedCallback(it) }
        }
        webView.destroy()
        super.onDestroy()
    }

    private fun flushPending() {
        while (true) {
            val transaction = pendingTransactions.poll() ?: break
            val json = ConfirmBus.toJson(transaction)
            val script = "window.dispatchEvent(new CustomEvent('self-agent:auto-txn',{detail:$json}));"
            webView.evaluateJavascript(script, null)
        }
        val trips = JSONArray()
        while (true) {
            val trip = pendingTravels.poll() ?: TravelBus.pending.poll() ?: break
            trips.put(trip)
        }
        if (trips.length() > 0) {
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('self-agent:travel-updated',{detail:$trips}));",
                null
            )
        }
        while (true) {
            val health = pendingHealth.poll() ?: HealthBus.pending.poll() ?: break
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('self-agent:health-import',{detail:$health}));",
                null
            )
        }
        while (true) {
            val quotes = pendingQuotes.poll() ?: QuoteBus.pending.poll() ?: break
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('self-agent:quotes-updated',{detail:$quotes}));",
                null
            )
        }
        while (true) {
            val text = pendingCapture.poll() ?: break
            val payload = JSONObject().put("text", text)
            webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('self-agent:capture-text',{detail:$payload}));",
                null
            )
        }
    }

    private fun applyLedgerIntent(intent: Intent?) {
        val json = intent?.getStringExtra(EXTRA_TXN) ?: return
        val autoSave = intent.getBooleanExtra(EXTRA_AUTO_SAVE, false)
        val payload = JSONObject(json).put("autoSave", autoSave)
        val notifyId = payload.optString("id").hashCode() and 0x7fffffff
        if (notifyId != 0) (getSystemService(NOTIFICATION_SERVICE) as android.app.NotificationManager).cancel(notifyId)
        webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('self-agent:auto-txn',{detail:$payload}));",
            null
        )
        intent.removeExtra(EXTRA_TXN)
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun openNotificationAccess() {
            startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"))
        }

        @JavascriptInterface
        fun openAccessibilitySettings() {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        @JavascriptInterface
        fun openAutofillSettings() {
            val intent = Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE)
                .setData(Uri.parse("package:$packageName"))
            startActivity(intent)
        }

        @JavascriptInterface
        fun vaultMeta(): String = EncryptedVault.listMeta(this@MainActivity).toString()

        @JavascriptInterface
        fun nativeReady(): Boolean = true

        @JavascriptInterface
        fun importHealthConnect() {
            startActivity(Intent(this@MainActivity, HealthImportActivity::class.java))
        }

        @JavascriptInterface
        fun importGadgetbridge() {
            if (!GadgetbridgeImportActivity.importSaved(this@MainActivity)) {
                startActivity(Intent(this@MainActivity, GadgetbridgeImportActivity::class.java))
            }
        }

        @JavascriptInterface
        fun openHealthConnectHelp() {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }

        @JavascriptInterface
        fun appVersion(): String = BuildConfig.VERSION_NAME

        @JavascriptInterface
        fun capabilityStatus(): String = CapabilityStatus.json(this@MainActivity)

        @JavascriptInterface
        fun syncReminders(json: String): String {
            val result = app.selfagent.reminders.ReminderScheduler.sync(this@MainActivity, json)
            if (runCatching { org.json.JSONObject(json).optBoolean("ack") }.getOrDefault(false)) {
                runOnUiThread { requestUnrestrictedBattery() }
            }
            return result
        }

        @JavascriptInterface
        fun syncQuotes(json: String) {
            QuoteSync.sync(this@MainActivity, json)
        }

        @JavascriptInterface
        fun refreshQuotes() {
            QuoteSync.refreshNow(this@MainActivity)
        }

        @JavascriptInterface
        fun startVoiceCapture() {
            runOnUiThread { capture.startVoice() }
        }

        @JavascriptInterface
        fun pickCaptureImage() {
            runOnUiThread { capture.pickImage() }
        }

        @JavascriptInterface
        fun revealPassword(id: String) {
            runOnUiThread { VaultReveal.start(this@MainActivity, id) }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (::capture.isInitialized) {
            capture.onPermission(requestCode, grantResults.firstOrNull() == android.content.pm.PackageManager.PERMISSION_GRANTED)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == CaptureController.REQUEST_IMAGE && ::capture.isInitialized) {
            capture.onImage(if (resultCode == RESULT_OK) data?.data else null)
        }
        if (requestCode == VaultReveal.REQUEST_CREDENTIAL) {
            VaultReveal.onCredentialResult(this, resultCode == RESULT_OK)
        }
    }
}
