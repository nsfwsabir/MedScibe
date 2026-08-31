import * as SQLite from 'expo-sqlite';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('medscribe.db');
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS pending_notes (
          local_id TEXT PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL,
          audio_uri TEXT,
          duration_seconds INTEGER,
          created_at TEXT NOT NULL
        );`,
      );
      return db;
    })();
  }
  return dbPromise;
}
