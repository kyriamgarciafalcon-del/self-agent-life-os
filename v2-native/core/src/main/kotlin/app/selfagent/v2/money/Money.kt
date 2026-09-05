package app.selfagent.v2.money

enum class MoneyError {
    INVALID,
    UNKNOWN_CURRENCY,
    OVERFLOW,
    MIXED_CURRENCY,
    SCALE,
}

class MoneyException(val code: MoneyError) : IllegalArgumentException(code.name)

enum class Currency(val scale: Int) {
    CNY(2),
    USD(2),
    HKD(2),
    EUR(2),
    JPY(0);

    companion object {
        fun parse(code: String): Currency =
            entries.find { it.name == code } ?: throw MoneyException(MoneyError.UNKNOWN_CURRENCY)
    }
}

class Money(val minor: Long, val currency: Currency) {
    fun plus(other: Money): Money {
        if (currency != other.currency) throw MoneyException(MoneyError.MIXED_CURRENCY)
        return try {
            Money(Math.addExact(minor, other.minor), currency)
        } catch (_: ArithmeticException) {
            throw MoneyException(MoneyError.OVERFLOW)
        }
    }

    companion object {
        fun parse(text: String): Money = parse(text, Currency.CNY)

        fun parse(text: String, currency: Currency): Money {
            val raw = text.trim()
            if (raw.isEmpty()) throw MoneyException(MoneyError.INVALID)
            var index = 0
            var sign = 1
            if (raw[0] == '+' || raw[0] == '-') {
                if (raw[0] == '-') sign = -1
                index += 1
            }
            if (index >= raw.length) throw MoneyException(MoneyError.INVALID)
            val dot = raw.indexOf('.', startIndex = index)
            val minor = try {
                if (dot < 0) {
                    val whole = raw.substring(index)
                    if (whole.isEmpty() || whole.any { !it.isDigit() }) throw MoneyException(MoneyError.INVALID)
                    Math.multiplyExact(whole.toLong(), pow10(currency.scale))
                } else {
                    if (currency.scale == 0) throw MoneyException(MoneyError.SCALE)
                    val whole = raw.substring(index, dot)
                    val fraction = raw.substring(dot + 1)
                    if (whole.isEmpty() || fraction.isEmpty() || whole.any { !it.isDigit() } || fraction.any { !it.isDigit() }) {
                        throw MoneyException(MoneyError.INVALID)
                    }
                    if (fraction.length > currency.scale) throw MoneyException(MoneyError.SCALE)
                    val padded = fraction.padEnd(currency.scale, '0')
                    Math.addExact(
                        Math.multiplyExact(whole.toLong(), pow10(currency.scale)),
                        padded.toLong(),
                    )
                }
            } catch (error: NumberFormatException) {
                throw MoneyException(MoneyError.INVALID)
            } catch (error: ArithmeticException) {
                throw MoneyException(MoneyError.OVERFLOW)
            }
            return try {
                Money(if (sign < 0) Math.negateExact(minor) else minor, currency)
            } catch (_: ArithmeticException) {
                throw MoneyException(MoneyError.OVERFLOW)
            }
        }

        private fun pow10(scale: Int): Long {
            var value = 1L
            repeat(scale) { value = Math.multiplyExact(value, 10L) }
            return value
        }
    }
}
