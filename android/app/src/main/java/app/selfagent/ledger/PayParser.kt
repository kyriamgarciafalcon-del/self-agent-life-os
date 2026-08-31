package app.selfagent.ledger

data class PendingTxn(
    val id: String,
    val amount: Double?,
    val dir: String,
    val title: String,
    val source: String,
    val accountHint: String,
    val category: String,
    val raw: String,
    val at: Long,
    val channel: String = "unknown",
)

object PayParser {
    private val payHint = Regex("支付成功|付款成功|已支付|已付款|消费成功|转账成功|收款成功|到账|收款")
    private val yen = Regex("[¥￥]\\s*(\\d+(?:\\.\\d{1,2})?)")
    private val yuan = Regex("(\\d+(?:\\.\\d{1,2})?)\\s*元")

    fun sourceOf(pkg: String) = when (pkg) {
        "com.tencent.mm" -> "wechat"
        "com.eg.android.AlipayGphone" -> "alipay"
        "com.unionpay" -> "unionpay"
        else -> "other"
    }

    fun isPayText(raw: String) = payHint.containsMatchIn(raw)

    fun parseAmount(raw: String): Double? =
        yen.find(raw)?.groupValues?.get(1)?.toDoubleOrNull()
            ?: yuan.find(raw)?.groupValues?.get(1)?.toDoubleOrNull()

    fun parse(
        pkg: String,
        raw: String,
        at: Long = System.currentTimeMillis(),
        channel: String = "unknown",
        sourceEventId: String? = null,
    ): PendingTxn? {
        val text = raw.replace(Regex("\\s+"), " ").trim()
        if (text.isEmpty() || !isPayText(text)) return null
        val source = sourceOf(pkg)
        val amount = parseAmount(text)
        val incoming = Regex("收款|到账").containsMatchIn(text) &&
            !Regex("支付成功|付款成功|已支付|消费成功").containsMatchIn(text)
        val merchant = Regex("(?:向|给)\\s*([^\\s，。,¥￥]{2,16})").find(text)
            ?.groupValues?.get(1)?.replace(Regex("支付|付款"), "")?.trim()
            ?: Regex("(?:来自|商户|商家)[:：]?\\s*([^\\s，。,¥￥]{2,16})").find(text)
                ?.groupValues?.get(1)?.trim()
        val title = merchant?.ifBlank { null }
            ?: if (source == "wechat") "微信支付" else if (source == "alipay") "支付宝" else if (source == "unionpay") "云闪付" else "支付"
        val category = when {
            incoming -> "收入"
            Regex("餐|饭|面|外卖|咖啡|奶茶|星巴克").containsMatchIn(text) -> "餐饮"
            Regex("地铁|打车|滴滴|公交|加油").containsMatchIn(text) -> "交通"
            else -> "其他"
        }
        val dir = if (incoming) "in" else "out"
        val id = sourceEventId?.trim()?.takeIf { it.isNotEmpty() }
            ?: java.util.UUID.nameUUIDFromBytes(
                listOf(source, amount?.toString() ?: "na", title, dir, channel, at.toString()).joinToString("|").toByteArray()
            ).toString()
        return PendingTxn(
            id = id,
            amount = amount,
            dir = dir,
            title = title,
            source = source,
            accountHint = if (source == "alipay") "支付宝" else if (source == "wechat") "微信零钱/银行卡" else "资金账户",
            category = category,
            raw = text,
            at = at,
            channel = channel,
        )
    }
}
