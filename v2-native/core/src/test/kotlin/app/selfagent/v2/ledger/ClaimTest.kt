package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path

class ClaimTest {
    @TempDir
    lateinit var dir: Path

    @Test
    fun `partial settle then reject overpay`() {
        val store = LedgerStore.open(dir.resolve("ledger.sqlite"))
        store.createLedgerAccount("cash", Currency.CNY, AccountRole.CASH)
        store.createLedgerAccount("receivable", Currency.CNY, AccountRole.RECEIVABLE)
        store.createLedgerAccount("expense", Currency.CNY, AccountRole.EXPENSE)
        PostJournal(store).execute(
            JournalCommand(
                commandId = "pad",
                journalId = "j-pad",
                postings = listOf(
                    PostingInput("p1", "expense", amount = "100.00"),
                    PostingInput("p2", "receivable", amount = "200.00"),
                    PostingInput("p3", "cash", amount = "-300.00"),
                ),
            ),
        )
        val claims = ClaimService(store)
        claims.open(ClaimDraft("claim-1", "j-pad", "200.00"))
        assertEquals(20000L, claims.outstanding("claim-1"))
        claims.settle(SettleDraft("set-1", "j-set", "claim-1", "cash", "120.00"))
        assertEquals(8000L, claims.outstanding("claim-1"))
        assertEquals(-18000L, store.balance("cash", Currency.CNY))
        assertEquals(8000L, store.balance("receivable", Currency.CNY))
        val over = assertThrows(LedgerException::class.java) {
            claims.settle(SettleDraft("set-2", "j-over", "claim-1", "cash", "90.00"))
        }
        assertEquals(LedgerError.OVER_SETTLE, over.code)
        assertEquals(8000L, claims.outstanding("claim-1"))
    }
}
