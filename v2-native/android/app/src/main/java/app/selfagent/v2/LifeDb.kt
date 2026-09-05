package app.selfagent.v2

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

internal class LifeDb(context: Context) : SQLiteOpenHelper(context, "v2-life.sqlite", null, 2) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE task_rule (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              kind TEXT NOT NULL
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE task_instance (
              rule_id TEXT NOT NULL,
              day TEXT NOT NULL,
              PRIMARY KEY (rule_id, day)
            )
            """.trimIndent(),
        )
        db.execSQL(
            """
            CREATE TABLE calendar_event (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              start TEXT NOT NULL
            )
            """.trimIndent(),
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS calendar_event (
                  id TEXT PRIMARY KEY,
                  title TEXT NOT NULL,
                  start TEXT NOT NULL
                )
                """.trimIndent(),
            )
        }
    }
}
