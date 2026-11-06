/**
 * Android: lokaler Speicher in SQLite.
 * (Im Browser wird stattdessen store.web.ts verwendet.)
 */
import * as SQLite from 'expo-sqlite';
import type { BaseRecord, RecordTyp } from '../domain/types';
import type { RecordStore } from './RecordStore';

class SqliteStore implements RecordStore {
  private db: SQLite.SQLiteDatabase | null = null;

  private get d(): SQLite.SQLiteDatabase {
    if (!this.db) throw new Error('Speicher nicht initialisiert');
    return this.db;
  }

  async init() {
    if (this.db) return;
    this.db = await SQLite.openDatabaseAsync('bauleitung.db');
    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY NOT NULL,
        typ TEXT NOT NULL,
        projektId TEXT,
        version INTEGER NOT NULL,
        dirty INTEGER NOT NULL DEFAULT 0,
        json TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_records_typ ON records (typ, projektId);
      CREATE INDEX IF NOT EXISTS idx_records_dirty ON records (dirty);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    `);
  }

  async alle<T extends BaseRecord>(typ: RecordTyp, projektId?: string | null): Promise<T[]> {
    let rows: { json: string }[];
    if (projektId === undefined) {
      rows = await this.d.getAllAsync<{ json: string }>('SELECT json FROM records WHERE typ = ?', typ);
    } else if (projektId === null) {
      rows = await this.d.getAllAsync<{ json: string }>('SELECT json FROM records WHERE typ = ? AND projektId IS NULL', typ);
    } else {
      rows = await this.d.getAllAsync<{ json: string }>(
        'SELECT json FROM records WHERE typ = ? AND projektId = ?',
        typ,
        projektId,
      );
    }
    return rows.map((r) => JSON.parse(r.json) as T);
  }

  async hole<T extends BaseRecord>(id: string): Promise<T | undefined> {
    const row = await this.d.getFirstAsync<{ json: string }>('SELECT json FROM records WHERE id = ?', id);
    return row ? (JSON.parse(row.json) as T) : undefined;
  }

  async speichere(rec: BaseRecord, dirty: boolean) {
    await this.d.runAsync(
      'INSERT OR REPLACE INTO records (id, typ, projektId, version, dirty, json) VALUES (?, ?, ?, ?, ?, ?)',
      rec.id,
      rec.typ,
      rec.projektId,
      rec.version,
      dirty ? 1 : 0,
      JSON.stringify(rec),
    );
  }

  async ungesynct() {
    const rows = await this.d.getAllAsync<{ json: string }>('SELECT json FROM records WHERE dirty = 1');
    return rows.map((r) => JSON.parse(r.json) as BaseRecord);
  }

  async alsSynctMarkieren(id: string, version: number) {
    await this.d.runAsync('UPDATE records SET dirty = 0 WHERE id = ? AND version = ?', id, version);
  }

  async holeMeta(key: string) {
    const row = await this.d.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
    return row?.value;
  }

  async setzeMeta(key: string, value: string) {
    await this.d.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
  }
}

export function erzeugeStore(): RecordStore {
  return new SqliteStore();
}
