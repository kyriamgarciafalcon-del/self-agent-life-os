package app.selfagent.v2.ledger

import app.selfagent.v2.money.Currency
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path

class LedgerStoreTest {
    @TempDir
    lateinit var dir: Path

    private fun store(): LedgerStore = LedgerStore.open(dir.resolve("ledger.sqlite"))

    @Test
    fun `rejects posting that references a missing journal or account`() {
        val db = store()
        db.createLedgerAccount("cash", Currency.CNY)
        val error = assertThrows(LedgerException::class.java) {
            db.commitJournal(
                JournalDraft(
                    id = "j1",
                    commandId = "c1",
                    postings = listOf(
                        PostingDraft("p1", "missing-journal", "cash", 100, Currency.CNY),
                    ),
                ),
            )
        }
        assertEquals(LedgerError.FOREIGN_KEY, error.code)
    }

    @Test
    fun `rejects unbalanced journal`() {
        val db = store()
        db.createLedgerAccount("cash", Currency.CNY)
        db.createLedgerAccount("expense", Currency.CNY)
        val error = assertThrows(LedgerException::class.java) {
            db.commitJournal(
                JournalDraft(
                    id = "j1",
                    commandId = "c1",
                    postings = listOf(
                        PostingDraft("p1", "j1", "expense", 3000, Currency.CNY),
                        PostingDraft("p2", "j1", "cash", -2000, Currency.CNY),
                    ),
                ),
            )
        }
        assertEquals(LedgerError.UNBALANCED, error.code)
        assertEquals(0, db.journalCount())
    }

    @Test
    fun `rejects duplicate journal id`() {
        val db = store()
        db.createLedgerAccount("cash", Currency.CNY)
        db.createLedgerAccount("income", Currency.CNY)
        val balanced = JournalDraft(
            id = "j1",
            commandId = "c1",
            postings = listOf(
                PostingDraft("p1", "j1", "cash", 10000, Currency.CNY),
                PostingDraft("p2", "j1", "income", -10000, Currency.CNY),
            ),
        )
        db.commitJournal(balanced)
        val error = assertThrows(LedgerException::class.java) {
            db.commitJournal(balanced.copy(commandId = "c2", postings = balanced.postings.map { it.copy(id = it.id + "-b") }))
        }
        assertEquals(LedgerError.DUPLICATE_ID, error.code)
    }

    @Test
    fun `backup restore round trip keeps balances`() {
        val db = store()
        db.createLedgerAccount("cash", Currency.CNY)
        db.createLedgerAccount("expense", Currency.CNY)
        db.commitJournal(
            JournalDraft(
                id = "j1",
                commandId = "c1",
                postings = listOf(
                    PostingDraft("p1", "j1", "expense", 3000, Currency.CNY),
                    PostingDraft("p2", "j1", "cash", -3000, Currency.CNY),
                ),
            ),
        )
        val backup = dir.resolve("backup.sqlite")
        db.backupTo(backup)
        val restored = LedgerStore.open(dir.resolve("restored.sqlite"))
        restored.restoreFrom(backup)
        assertEquals(-3000L, restored.balance("cash", Currency.CNY))
        assertEquals(3000L, restored.balance("expense", Currency.CNY))
    }
}
