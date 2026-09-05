package app.selfagent.v2.migrate

import app.selfagent.v2.ledger.LedgerStore
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path

class LegacyImporterTest {
    @TempDir
    lateinit var dir: Path

    @Test
    fun `demo data is not applied`() {
        val report = LegacyImporter.dryRun(
            """{"schemaVersion":4,"demoMode":true,"accounts":[{"id":"wechat"}],"transactions":[{"id":"t1","kind":"expense","amount":30,"currency":"CNY"}]}""",
        )
        assertFalse(report.canApply)
        assertTrue(report.blockers.contains("DEMO"))
        assertEquals(0, report.transactionCount)
    }

    @Test
    fun `duplicate ids are isolated and store stays empty`() {
        val json = """
            {"schemaVersion":4,"demoMode":false,"accounts":[{"id":"cash","currency":"CNY"}],
             "transactions":[
               {"id":"t1","kind":"expense","amount":"10.00","accountId":"cash","currency":"CNY","occurredAt":"2026-09-01"},
               {"id":"t1","kind":"expense","amount":"20.00","accountId":"cash","currency":"CNY","occurredAt":"2026-09-02"}
             ]}
        """.trimIndent()
        val report = LegacyImporter.dryRun(json)
        assertFalse(report.canApply)
        assertTrue(report.ambiguities.any { it.contains("t1") })
        val store = LedgerStore.open(dir.resolve("ledger.sqlite"))
        LegacyImporter.applyIfClear(report, store)
        assertEquals(0, store.journalCount())
    }

    @Test
    fun `clear v4 snapshot reports mapped expenses and estimated dates`() {
        val json = """
            {"schemaVersion":4,"demoMode":false,"accounts":[{"id":"cash","currency":"CNY"}],
             "transactions":[
               {"id":"t1","kind":"expense","amount":"30.00","accountId":"cash","currency":"CNY","createdAt":"2026-09-01T12:00:00+08:00"}
             ]}
        """.trimIndent()
        val report = LegacyImporter.dryRun(json)
        assertTrue(report.canApply)
        assertEquals(1, report.transactionCount)
        assertEquals(1, report.estimatedOccurredAt)
        assertEquals("CNY", report.currencies.single())
        val store = LedgerStore.open(dir.resolve("ok.sqlite"))
        val before = store.journalCount()
        LegacyImporter.applyIfClear(report, store)
        assertEquals(before, store.journalCount())
        assertTrue(LegacyImporter.explain(report).contains("未写入"))
    }
}
