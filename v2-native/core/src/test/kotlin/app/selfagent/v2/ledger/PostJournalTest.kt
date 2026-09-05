package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path

class PostJournalTest {
    @TempDir
    lateinit var dir: Path

    private fun service(): PostJournal {
        val store = LedgerStore.open(dir.resolve("ledger.sqlite"))
        store.createLedgerAccount("cash", Currency.CNY, AccountRole.OTHER)
        store.createLedgerAccount("expense", Currency.CNY, AccountRole.OTHER)
        return PostJournal(store)
    }

    @Test
    fun `defaults omitted currency to CNY and posts a balanced expense`() {
        val posts = service()
        val receipt = posts.execute(
            JournalCommand(
                commandId = "cmd-1",
                journalId = "j1",
                postings = listOf(
                    PostingInput("p1", "expense", amount = "30.00"),
                    PostingInput("p2", "cash", amount = "-30.00"),
                ),
            ),
        )
        assertEquals("cmd-1", receipt.commandId)
        assertEquals("j1", receipt.journalId)
        assertEquals("committed", receipt.status)
        assertEquals(3000L, posts.store.balance("expense", Currency.CNY))
        assertEquals(-3000L, posts.store.balance("cash", Currency.CNY))
    }

    @Test
    fun `rejects zero amount missing account and currency mismatch`() {
        val posts = service()
        posts.store.createLedgerAccount("usd-cash", Currency.USD)
        assertEquals(
            LedgerError.INVALID,
            assertThrows(LedgerException::class.java) {
                posts.execute(
                    JournalCommand(
                        commandId = "zero",
                        journalId = "jz",
                        postings = listOf(
                            PostingInput("p1", "expense", amount = "0.00"),
                            PostingInput("p2", "cash", amount = "0.00"),
                        ),
                    ),
                )
            }.code,
        )
        assertEquals(
            LedgerError.FOREIGN_KEY,
            assertThrows(LedgerException::class.java) {
                posts.execute(
                    JournalCommand(
                        commandId = "missing",
                        journalId = "jm",
                        postings = listOf(
                            PostingInput("p1", "nope", amount = "1.00"),
                            PostingInput("p2", "cash", amount = "-1.00"),
                        ),
                    ),
                )
            }.code,
        )
        assertEquals(
            LedgerError.INVALID,
            assertThrows(LedgerException::class.java) {
                posts.execute(
                    JournalCommand(
                        commandId = "fx",
                        journalId = "jf",
                        postings = listOf(
                            PostingInput("p1", "usd-cash", amount = "1.00"),
                            PostingInput("p2", "cash", amount = "-1.00"),
                        ),
                    ),
                )
            }.code,
        )
        assertEquals(0, posts.store.journalCount())
    }

    @Test
    fun `same commandId and payload is idempotent different payload conflicts`() {
        val posts = service()
        val command = JournalCommand(
            commandId = "cmd-dup",
            journalId = "j-dup",
            postings = listOf(
                PostingInput("p1", "expense", amount = "10.00"),
                PostingInput("p2", "cash", amount = "-10.00"),
            ),
        )
        val first = posts.execute(command)
        val second = posts.execute(command)
        assertEquals(first.journalId, second.journalId)
        assertEquals(1, posts.store.journalCount())
        val conflict = assertThrows(LedgerException::class.java) {
            posts.execute(command.copy(journalId = "j-other"))
        }
        assertEquals(LedgerError.COMMAND_CONFLICT, conflict.code)
        assertEquals(1, posts.store.journalCount())
    }
}
