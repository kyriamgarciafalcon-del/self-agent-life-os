package app.selfagent.vault

import android.app.assist.AssistStructure
import android.os.CancellationSignal
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveInfo
import android.service.autofill.SaveRequest
import android.text.InputType
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import app.selfagent.R

class SelfAgentAutofillService : AutofillService() {

    override fun onFillRequest(
        request: FillRequest,
        cancellationSignal: CancellationSignal,
        callback: FillCallback
    ) {
        val structure = request.fillContexts.lastOrNull()?.structure
        val fields = findFields(structure)
        val domain = webDomain(structure)
        val entry = EncryptedVault.findForPackage(this, structure?.activityComponent?.packageName ?: packageName, domain)
        if (fields.userId == null || fields.passId == null || entry == null) {
            val builder = FillResponse.Builder()
            if (fields.userId != null && fields.passId != null) {
                builder.setSaveInfo(
                    SaveInfo.Builder(SaveInfo.SAVE_DATA_TYPE_USERNAME or SaveInfo.SAVE_DATA_TYPE_PASSWORD, arrayOf(fields.userId, fields.passId)).build()
                )
                callback.onSuccess(builder.build())
            } else {
                callback.onSuccess(null)
            }
            return
        }
        val presentation = RemoteViews(packageName, R.layout.autofill_item).apply {
            setTextViewText(R.id.autofill_title, "Self Agent · ${entry.title}")
            setTextViewText(R.id.autofill_subtitle, entry.username)
        }
        val dataset = Dataset.Builder(presentation)
            .setValue(fields.userId, AutofillValue.forText(entry.username), presentation)
            .setValue(fields.passId, AutofillValue.forText(entry.password), presentation)
            .build()
        val response = FillResponse.Builder()
            .addDataset(dataset)
            .setSaveInfo(
                SaveInfo.Builder(SaveInfo.SAVE_DATA_TYPE_USERNAME or SaveInfo.SAVE_DATA_TYPE_PASSWORD, arrayOf(fields.userId, fields.passId)).build()
            )
            .build()
        callback.onSuccess(response)
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        val parsed = extractLogin(request.fillContexts.lastOrNull()?.structure)
        if (parsed == null) {
            callback.onFailure("no login fields")
            return
        }
        EncryptedVault.save(this, parsed.app, parsed.username, parsed.password)
        callback.onSuccess()
    }

    private data class Fields(val userId: AutofillId?, val passId: AutofillId?)
    private data class Login(val app: String, val username: String, val password: String)

    private fun findFields(structure: AssistStructure?): Fields {
        var user: AutofillId? = null
        var pass: AutofillId? = null
        if (structure == null) return Fields(null, null)
        for (i in 0 until structure.windowNodeCount) {
            walk(structure.getWindowNodeAt(i).rootViewNode) { node ->
                val hints = node.autofillHints?.toList().orEmpty()
                val id = node.autofillId ?: return@walk
                when {
                    hints.any { it.contains("password", true) } ||
                        node.inputType and InputType.TYPE_TEXT_VARIATION_PASSWORD != 0 ||
                        node.inputType and InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD != 0 ||
                        node.inputType and InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD != 0 -> pass = id
                    hints.any { it.contains("username", true) || it.contains("email", true) } -> user = id
                }
            }
        }
        return Fields(user, pass)
    }

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
                        node.inputType and InputType.TYPE_TEXT_VARIATION_PASSWORD != 0 ||
                        node.inputType and InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD != 0 -> pass = value
                    hints.any { it.contains("username", true) || it.contains("email", true) } -> user = value
                }
            }
        }
        val u = user ?: return null
        val p = pass ?: return null
        val domain = webDomain(structure)
        val pkg = structure.activityComponent?.packageName ?: packageName
        val app = if (!domain.isNullOrBlank()) "web:$domain" else pkg
        return Login(app, u, p)
    }

    private fun webDomain(structure: AssistStructure?): String? {
        if (structure == null) return null
        var domain: String? = null
        for (i in 0 until structure.windowNodeCount) {
            walk(structure.getWindowNodeAt(i).rootViewNode) { node ->
                if (!node.webDomain.isNullOrBlank()) domain = node.webDomain
            }
        }
        return domain
    }

    private fun walk(node: AssistStructure.ViewNode, visit: (AssistStructure.ViewNode) -> Unit) {
        visit(node)
        for (i in 0 until node.childCount) walk(node.getChildAt(i), visit)
    }
}
