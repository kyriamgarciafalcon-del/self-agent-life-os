package app.selfagent.v2.inbox

import app.selfagent.v2.ledger.LedgerStore
import app.selfagent.v2.ledger.PostJournal
import app.selfagent.v2.ledger.RecordExpense
import app.selfagent.v2.money.Currency
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path

class InboxServiceTest {
    @TempDir
    lateinit var dir: Path

    private fun books() = LedgerStore.open(dir.resolve("ledger.sqlite")).also { it.ensureCashAndExpenseAccounts() }

    private fun inbox(store: LedgerStore = books()): InboxService =
        InboxService.open(dir.resolve("inbox.sqlite"), RecordExpense(PostJournal(store), store))

    @Test
    fun `draft is not a journal until confirmed`() {
        val inbox = inbox()
        inbox.offer(InboxDraft("d1", "30.00", version = 1))
        assertEquals(1, inbox.pending().size)
        assertEquals(0, inbox.record.books.journalCount())
        assertEquals(0L, inbox.record.books.balance("expense", Currency.CNY))
    }

    @Test
    fun `confirm twice with same version posts once`() {
        val inbox = inbox()
        inbox.offer(InboxDraft("d1", "30.00", version = 1))
        inbox.confirm("d1", expectedVersion = 1)
        inbox.confirm("d1", expectedVersion = 1)
        assertEquals(0, inbox.pending().size)
        assertEquals(1, inbox.record.books.journalCount())
        assertEquals(3000L, inbox.record.books.balance("expense", Currency.CNY))
    }

    @Test
    fun `ignore never posts and stale version is rejected`() {
        val inbox = inbox()
        inbox.offer(InboxDraft("d1", "10.00", version = 1))
        inbox.offer(InboxDraft("d1", "20.00", version = 2))
        try {
            inbox.ignore("d1", expectedVersion = 1)
        } catch (_: app.selfagent.v2.ledger.LedgerException) {
        }
        assertEquals(1, inbox.pending().size)
        inbox.confirm("d1", expectedVersion = 2)
        assertEquals(0, inbox.pending().size)
        assertEquals(2000L, inbox.record.books.balance("expense", Currency.CNY))
        assertEquals(1, inbox.record.books.journalCount())
    }

    @Test
    fun `reopened file still has pending draft and no journal`() {
        val store = books()
        inbox(store).offer(InboxDraft("keep", "12.00", version = 1))
        val again = InboxService.open(dir.resolve("inbox.sqlite"), RecordExpense(PostJournal(store), store))
        assertEquals(listOf("keep"), again.pending().map { it.id })
        assertEquals(0, store.journalCount())
        again.confirm("keep", expectedVersion = 1)
        assertEquals(1200L, store.balance("expense", Currency.CNY))
    }
}
