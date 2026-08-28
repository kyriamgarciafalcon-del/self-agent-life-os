package app.selfagent.vault

import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.SaveCallback
import android.service.autofill.SaveRequest
import android.app.assist.AssistStructure

class SelfAgentAutofillService : AutofillService() {

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        callback.onSuccess(null)
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        val parsed = extractLogin(request.fillContexts.lastOrNull()?.structure)
        if (parsed == null) {
            callback.onFailure("no login fields")
            return
        }
        VaultStore.save(parsed.app, parsed.username, parsed.password)
        callback.onSuccess()
    }

    private data class Login(val app: String, val username: String, val password: String)

    private fun extractLogin(structure: AssistStructure?): Login? {
        if (structure == null) return null
        var user: String? = null
        var pass: String? = null
        for (i in 0 until structure.windowNodeCount) {
            walk(structure.getWindowNodeAt(i).rootViewNode) { node ->
                val hints = node.autofillHints?.toList().orEmpty()
                val value = node.autofillValue?.textValue?.toString()
                if (value.isNullOrBlank()) return@walk
                when {
                    hints.any { it.contains("password", true) } ||
                        node.inputType and android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD != 0 -> pass = value
                    hints.any { it.contains("username", true) || it.contains("email", true) } -> user = value
                }
            }
        }
        val u = user ?: return null
        val p = pass ?: return null
        return Login(packageName ?: "unknown", u, p)
    }

    private fun walk(node: AssistStructure.ViewNode, visit: (AssistStructure.ViewNode) -> Unit) {
        visit(node)
        for (i in 0 until node.childCount) walk(node.getChildAt(i), visit)
    }
}

object VaultStore {
    fun save(app: String, username: String, password: String) {
        EncryptedVault.put(app, username, password)
    }
}

object EncryptedVault {
    private val mem = LinkedHashMap<String, Pair<String, String>>()
    fun put(app: String, username: String, password: String) {
        mem[app] = username to password
    }
}
