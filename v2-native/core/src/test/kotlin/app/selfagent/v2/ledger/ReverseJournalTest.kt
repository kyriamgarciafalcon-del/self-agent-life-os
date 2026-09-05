package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path

class ReverseJournalTest {
    @TempDir
    lateinit var dir: Path

    private fun books(): Pair<PostJournal, LedgerStore> {
        val store = LedgerStore.open(dir.resolve("ledger.sqlite"))
        store.createLedgerAccount("cash", Currency.CNY, AccountRole.CASH)
        store.createLedgerAccount("expense", Currency.CNY, AccountRole.EXPENSE)
        return PostJournal(store) to store
    }

    @Test
    fun `reverse posts opposite amounts keeps original and is idempotent`() {
        val (posts, store) = books()
        posts.execute(
            JournalCommand(
                commandId = "e1",
                journalId = "j-exp",
                postings = listOf(
                    PostingInput("p1", "expense", amount = "30.00"),
                    PostingInput("p2", "cash", amount = "-30.00"),
                ),
            ),
        )
        val reverse = ReverseJournal(store)
        val first = reverse.execute(ReverseCommand("rev-1", "j-rev", "j-exp", "记错"))
        val second = reverse.execute(ReverseCommand("rev-1", "j-rev", "j-exp", "记错"))
        assertEquals(first.journalId, second.journalId)
        assertEquals(2, posts.store.journalCount())
        assertEquals(0L, posts.store.balance("cash", Currency.CNY))
        assertEquals(0L, posts.store.balance("expense", Currency.CNY))
        assertThrows(LedgerException::class.java) {
            reverse.execute(ReverseCommand("rev-2", "j-rev-2", "j-exp", "再冲"))
        }.also { assertEquals(LedgerError.ALREADY_REVERSED, it.code) }
    }
}
