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
import android.view.View
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
        if (fields.passId == null) {
            callback.onSuccess(null)
            return
        }
        val domain = webDomain(structure)
        val pkg = structure?.activityComponent?.packageName ?: packageName
        val entry = EncryptedVault.findForPackage(this, pkg, domain)
        val builder = FillResponse.Builder().setSaveInfo(saveInfo(fields))
        if (entry != null) {
            val presentation = RemoteViews(packageName, R.layout.autofill_item).apply {
                setTextViewText(R.id.autofill_title, "Self Agent · ${entry.title}")
                setTextViewText(R.id.autofill_subtitle, entry.username.ifBlank { "已保存的账号" })
            }
            val dataset = Dataset.Builder(presentation)
            fields.userId?.let { dataset.setValue(it, AutofillValue.forText(entry.username), presentation) }
            dataset.setValue(fields.passId, AutofillValue.forText(entry.password), presentation)
            builder.addDataset(dataset.build())
        }
        callback.onSuccess(builder.build())
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        val parsed = request.fillContexts.asReversed().firstNotNullOfOrNull { extractLogin(it.structure) }
        if (parsed == null) {
            callback.onFailure("no login fields")
            return
        }
        EncryptedVault.save(this, parsed.app, parsed.username, parsed.password)
        callback.onSuccess()
    }

    private data class Fields(val userId: AutofillId?, val passId: AutofillId?)
    private data class Login(val app: String, val username: String, val password: String)

    private fun saveInfo(fields: Fields): SaveInfo {
        val required = listOfNotNull(fields.passId, fields.userId).toTypedArray()
        val type = SaveInfo.SAVE_DATA_TYPE_PASSWORD or SaveInfo.SAVE_DATA_TYPE_USERNAME
        return SaveInfo.Builder(type, required)
            .setFlags(SaveInfo.FLAG_SAVE_ON_ALL_VIEWS_INVISIBLE)
            .build()
    }

    private fun findFields(structure: AssistStructure?): Fields {
        val nodes = mutableListOf<AssistStructure.ViewNode>()
        if (structure != null) {
            for (i in 0 until structure.windowNodeCount) walk(structure.getWindowNodeAt(i).rootViewNode) { nodes.add(it) }
        }
        val inputs = nodes.filter { it.autofillId != null && it.autofillType == View.AUTOFILL_TYPE_TEXT }
        val pass = inputs.lastOrNull { isPasswordNode(it) }
        val user = inputs.lastOrNull { isUsernameNode(it) && it.autofillId != pass?.autofillId }
            ?: inputs.lastOrNull { it.autofillId != pass?.autofillId && !isPasswordNode(it) && looksLikeInput(it) }
        return Fields(user?.autofillId, pass?.autofillId)
    }

    private fun extractLogin(structure: AssistStructure?): Login? {
        if (structure == null) return null
        val nodes = mutableListOf<AssistStructure.ViewNode>()
        for (i in 0 until structure.windowNodeCount) walk(structure.getWindowNodeAt(i).rootViewNode) { nodes.add(it) }
        val passNode = nodes.lastOrNull { isPasswordNode(it) && !nodeText(it).isNullOrBlank() } ?: return null
        val userNode = nodes.lastOrNull { isUsernameNode(it) && !nodeText(it).isNullOrBlank() }
            ?: nodes.lastOrNull { it !== passNode && looksLikeInput(it) && !isPasswordNode(it) && !nodeText(it).isNullOrBlank() }
        val password = nodeText(passNode) ?: return null
        val username = nodeText(userNode).orEmpty()
        if (username.isBlank() && password.isBlank()) return null
        val domain = webDomain(structure)
        val pkg = structure.activityComponent?.packageName ?: packageName
        val app = if (!domain.isNullOrBlank()) "web:$domain" else pkg
        return Login(app, username.ifBlank { "saved" }, password)
    }

    private fun isPasswordNode(node: AssistStructure.ViewNode): Boolean {
        if (hintBlob(node).contains("password") || hintBlob(node).contains("密码") || hintBlob(node).contains("口令") || hintBlob(node).contains("passwd") || hintBlob(node).contains("pwd")) {
            if (!hintBlob(node).contains("username") && !hintBlob(node).contains("账号")) return true
        }
        val variation = node.inputType and InputType.TYPE_MASK_VARIATION
        if (variation == InputType.TYPE_TEXT_VARIATION_PASSWORD ||
            variation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD ||
            variation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
        ) return true
        node.htmlInfo?.attributes?.forEach { attr ->
            val name = attr.first.orEmpty().lowercase()
            val value = attr.second.orEmpty().lowercase()
            if (name == "type" && value == "password") return true
            if (name == "autocomplete" && value.contains("password")) return true
        }
        return false
    }

    private fun isUsernameNode(node: AssistStructure.ViewNode): Boolean {
        if (isPasswordNode(node)) return false
        val blob = hintBlob(node)
        if (listOf("username", "email", "phone", "account", "login", "user", "账号", "用户名", "邮箱", "手机").any { blob.contains(it) }) return true
        node.autofillHints?.forEach { hint ->
            if (hint.contains("username", true) || hint.contains("email", true) || hint.contains("phone", true)) return true
        }
        val variation = node.inputType and InputType.TYPE_MASK_VARIATION
        if (variation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS ||
            variation == InputType.TYPE_TEXT_VARIATION_PERSON_NAME ||
            variation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS
        ) return true
        if (node.inputType and InputType.TYPE_MASK_CLASS == InputType.TYPE_CLASS_PHONE) return true
        node.htmlInfo?.attributes?.forEach { attr ->
            val name = attr.first.orEmpty().lowercase()
            val value = attr.second.orEmpty().lowercase()
            if (name == "type" && (value == "email" || value == "tel")) return true
            if (name == "autocomplete" && (value.contains("username") || value.contains("email"))) return true
        }
        return false
    }

    private fun looksLikeInput(node: AssistStructure.ViewNode): Boolean {
        val cls = node.className?.toString().orEmpty()
        return cls.contains("EditText", true) || cls.contains("Input", true) || node.htmlInfo != null
    }

    private fun hintBlob(node: AssistStructure.ViewNode): String {
        val parts = buildList {
            add(node.idEntry.orEmpty())
            add(node.hint.orEmpty())
            add(node.text?.toString().orEmpty())
            add(node.autofillHints?.joinToString(" ").orEmpty())
            add(node.webDomain.orEmpty())
        }
        return parts.joinToString(" ").lowercase()
    }

    private fun nodeText(node: AssistStructure.ViewNode?): String? =
        node?.autofillValue?.textValue?.toString()?.takeIf { it.isNotBlank() }

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
