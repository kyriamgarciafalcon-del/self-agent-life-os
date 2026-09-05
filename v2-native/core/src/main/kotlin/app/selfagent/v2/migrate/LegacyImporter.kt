package app.selfagent.v2.migrate

import app.selfagent.v2.ledger.LedgerStore
import org.json.JSONArray
import org.json.JSONObject

data class DryRunReport(
    val canApply: Boolean,
    val blockers: List<String>,
    val ambiguities: List<String>,
    val transactionCount: Int,
    val estimatedOccurredAt: Int,
    val currencies: List<String>,
)

object LegacyImporter {
    fun dryRun(json: String): DryRunReport {
        val root = JSONObject(json)
        val blockers = mutableListOf<String>()
        val ambiguities = mutableListOf<String>()
        if (root.optBoolean("demoMode", false)) blockers += "DEMO"
        if (root.optInt("schemaVersion") != 4) blockers += "SCHEMA"
        val transactions = root.optJSONArray("transactions") ?: JSONArray()
        val seen = mutableSetOf<String>()
        var estimated = 0
        val currencies = linkedSetOf<String>()
        if ("DEMO" in blockers) {
            return DryRunReport(false, blockers, ambiguities, 0, 0, emptyList())
        }
        for (index in 0 until transactions.length()) {
            val item = transactions.getJSONObject(index)
            val id = item.optString("id")
            if (id.isBlank()) {
                ambiguities += "missing-id@$index"
                continue
            }
            if (!seen.add(id)) ambiguities += id
            if (item.optString("occurredAt").isBlank()) estimated += 1
            val currency = item.optString("currency").ifBlank { "CNY" }
            currencies += currency
        }
        if (ambiguities.isNotEmpty()) blockers += "AMBIGUOUS_ID"
        return DryRunReport(
            canApply = blockers.isEmpty(),
            blockers = blockers,
            ambiguities = ambiguities,
            transactionCount = if (blockers.isEmpty()) transactions.length() else 0,
            estimatedOccurredAt = if (blockers.isEmpty()) estimated else 0,
            currencies = currencies.toList(),
        )
    }

    fun applyIfClear(report: DryRunReport, store: LedgerStore) {
        if (!report.canApply) return
    }

    fun explain(report: DryRunReport): String {
        if (!report.canApply) {
            val ids = report.ambiguities.take(8).joinToString().ifBlank { "无" }
            return "不能切换当前库。原因：${report.blockers.joinToString()}。歧义：$ids。现有账本未改。"
        }
        return "可映射 ${report.transactionCount} 笔，估算日期 ${report.estimatedOccurredAt}，币种 ${report.currencies.joinToString()}。未写入，当前库不变。"
    }
}
