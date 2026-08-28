package app.selfagent

import android.annotation.SuppressLint
import android.app.Activity
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
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import app.selfagent.health.HealthBus
import app.selfagent.health.HealthImportActivity
import app.selfagent.ledger.ConfirmBus
import app.selfagent.ledger.PendingTxn
import app.selfagent.travel.TravelBus
import app.selfagent.vault.EncryptedVault
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentLinkedQueue

class MainActivity : Activity() {

    private lateinit var webView: WebView
    private val pendingTransactions = ConcurrentLinkedQueue<PendingTxn>()
    private val pendingTravels = ConcurrentLinkedQueue<JSONObject>()
    private val pendingHealth = ConcurrentLinkedQueue<JSONObject>()
    private var backCallback: OnBackInvokedCallback? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestWindowFeature(Window.FEATURE_NO_TITLE)

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
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    val host = trustedHost()
                    val allowedScheme = uri.scheme == "https" || uri.scheme == "http"
                    return if (allowedScheme && host != null && uri.host == host) {
                        false
                    } else {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                        true
                    }
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
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = OnBackInvokedCallback { handleWebBack() }
            onBackInvokedDispatcher.registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                backCallback!!
            )
        }
        webView.loadUrl(BuildConfig.WEB_APP_URL)
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

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) flushPending()
    }

    override fun onDestroy() {
        ConfirmBus.sink = null
        TravelBus.sink = null
        HealthBus.sink = null
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
            val script = "window.dispatchEvent(new CustomEvent('self-agent:auto-txn',{detail:$json}));" +
                "window.onAutoTxn && window.onAutoTxn($json);"
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
    }

    private fun trustedHost(): String? = Uri.parse(BuildConfig.WEB_APP_URL).host

    inner class AndroidBridge {
        @JavascriptInterface
        fun openNotificationAccess() {
            startActivity(Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"))
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
        fun openHealthConnectHelp() {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }

        @JavascriptInterface
        fun appVersion(): String = BuildConfig.VERSION_NAME
    }
}
