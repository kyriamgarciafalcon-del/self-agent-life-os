package app.selfagent

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.Window
import app.selfagent.ledger.ConfirmBus
import app.selfagent.ledger.PendingTxn
import java.util.concurrent.ConcurrentLinkedQueue

class MainActivity : Activity() {

    private lateinit var webView: WebView
    private val pendingTransactions = ConcurrentLinkedQueue<PendingTxn>()

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
        }
        setContentView(webView)

        ConfirmBus.sink = { transaction ->
            pendingTransactions.add(transaction)
            runOnUiThread { flushPendingTransactions() }
        }
        webView.loadUrl(BuildConfig.WEB_APP_URL)
    }

    override fun onResume() {
        super.onResume()
        if (::webView.isInitialized) flushPendingTransactions()
    }

    override fun onDestroy() {
        ConfirmBus.sink = null
        webView.destroy()
        super.onDestroy()
    }

    private fun flushPendingTransactions() {
        while (true) {
            val transaction = pendingTransactions.poll() ?: break
            val json = ConfirmBus.toJson(transaction)
            val script = "window.dispatchEvent(new CustomEvent('self-agent:auto-txn',{detail:$json}));" +
                "window.onAutoTxn && window.onAutoTxn($json);"
            webView.evaluateJavascript(script, null)
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
        fun appVersion(): String = BuildConfig.VERSION_NAME
    }

}
