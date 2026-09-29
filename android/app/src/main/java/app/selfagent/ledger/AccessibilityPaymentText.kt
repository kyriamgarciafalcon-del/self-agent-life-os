package app.selfagent.ledger

object AccessibilityPaymentText {
    const val MAX_TEXT_LENGTH = 1_800

    fun combine(nodeText: String, eventTexts: List<String>, previousEventText: String): String {
        val parts = listOf(nodeText) + eventTexts + previousEventText
        val result = StringBuilder()
        for (part in parts) {
            val clean = part.replace(Regex("\\s+"), " ").trim()
            if (clean.isEmpty() || result.contains(clean)) continue
            if (result.isNotEmpty()) result.append(' ')
            result.append(clean)
            if (result.length >= MAX_TEXT_LENGTH) break
        }
        return result.toString().take(MAX_TEXT_LENGTH)
    }
}
