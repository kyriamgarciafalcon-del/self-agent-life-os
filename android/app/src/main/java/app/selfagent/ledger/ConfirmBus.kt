package app.selfagent.ledger

import android.content.Context
import org.json.JSONObject

object ConfirmBus {
    @Volatile var sink: ((PendingTxn) -> Unit)? = null

    fun post(pending: PendingTxn, context: Context? = null) {
        val app = context?.applicationContext
        if (app != null && !TxnGuard.shouldPost(app, pending)) return
        app?.let { LedgerNotifier.show(it, pending) }
        sink?.invoke(pending)
    }

    fun toJson(p: PendingTxn): String = JSONObject()
        .put("id", p.id)
        .put("amount", p.amount)
        .put("dir", p.dir)
        .put("title", p.title)
        .put("source", p.source)
        .put("accountHint", p.accountHint)
        .put("category", p.category)
        .put("raw", p.raw)
        .put("at", p.at)
        .toString()
}
