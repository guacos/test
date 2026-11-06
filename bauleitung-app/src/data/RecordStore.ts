import type { BaseRecord, RecordTyp } from '../domain/types';

/**
 * Lokaler Speicher für Datensätze. Alles wird zuerst auf dem Gerät gespeichert
 * (offline zuerst). "dirty" = noch nicht mit OneDrive abgeglichen.
 *
 * Umsetzungen:
 *  - store.ts      Android: SQLite
 *  - store.web.ts  Browser (Mac): IndexedDB
 *  - MemoryStore   Tests
 */
export interface RecordStore {
  init(): Promise<void>;
  /** Alle Datensätze eines Typs (auch gelöschte), optional nur für ein Projekt. */
  alle<T extends BaseRecord>(typ: RecordTyp, projektId?: string | null): Promise<T[]>;
  hole<T extends BaseRecord>(id: string): Promise<T | undefined>;
  speichere(rec: BaseRecord, dirty: boolean): Promise<void>;
  /** Alle Datensätze mit lokalen Änderungen, die noch nicht hochgeladen sind. */
  ungesynct(): Promise<BaseRecord[]>;
  /** Nach erfolgreichem Hochladen: als abgeglichen markieren, falls sich die Version nicht geändert hat. */
  alsSynctMarkieren(id: string, version: number): Promise<void>;
  holeMeta(key: string): Promise<string | undefined>;
  setzeMeta(key: string, value: string): Promise<void>;
}

/** Einfacher Speicher im Arbeitsspeicher, für Tests. */
export class MemoryStore implements RecordStore {
  private recs = new Map<string, { rec: BaseRecord; dirty: boolean }>();
  private meta = new Map<string, string>();

  async init() {}

  async alle<T extends BaseRecord>(typ: RecordTyp, projektId?: string | null): Promise<T[]> {
    return [...this.recs.values()]
      .map((e) => e.rec)
      .filter((r) => r.typ === typ && (projektId === undefined || r.projektId === projektId))
      .map((r) => structuredClone(r) as T);
  }

  async hole<T extends BaseRecord>(id: string): Promise<T | undefined> {
    const e = this.recs.get(id);
    return e ? (structuredClone(e.rec) as T) : undefined;
  }

  async speichere(rec: BaseRecord, dirty: boolean) {
    this.recs.set(rec.id, { rec: structuredClone(rec), dirty });
  }

  async ungesynct() {
    return [...this.recs.values()].filter((e) => e.dirty).map((e) => structuredClone(e.rec));
  }

  async alsSynctMarkieren(id: string, version: number) {
    const e = this.recs.get(id);
    if (e && e.rec.version === version) e.dirty = false;
  }

  async holeMeta(key: string) {
    return this.meta.get(key);
  }

  async setzeMeta(key: string, value: string) {
    this.meta.set(key, value);
  }
}
