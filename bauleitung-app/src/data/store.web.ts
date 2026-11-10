/**
 * Browser (Mac): lokaler Speicher in IndexedDB.
 * Die Daten bleiben im Browser gespeichert, auch ohne Netz.
 */
import { openDB, type IDBPDatabase } from 'idb';
import type { BaseRecord, RecordTyp } from '../domain/types';
import type { RecordStore } from './RecordStore';

interface Zeile {
  id: string;
  typ: RecordTyp;
  /** IndexedDB kann null nicht indizieren, daher '' für "kein Projekt". */
  projektKey: string;
  version: number;
  dirty: 0 | 1;
  rec: BaseRecord;
}

class IdbStore implements RecordStore {
  private db: IDBPDatabase | null = null;

  private get d(): IDBPDatabase {
    if (!this.db) throw new Error('Speicher nicht initialisiert');
    return this.db;
  }

  async init() {
    if (this.db) return;
    this.db = await openDB('bauleitung', 1, {
      upgrade(db) {
        const records = db.createObjectStore('records', { keyPath: 'id' });
        records.createIndex('typProjekt', ['typ', 'projektKey']);
        records.createIndex('typ', 'typ');
        records.createIndex('dirty', 'dirty');
        db.createObjectStore('meta');
      },
    });
    // Browser bitten, die Daten nicht automatisch zu löschen.
    try {
      await navigator.storage?.persist?.();
    } catch {
      /* nicht unterstützt */
    }
  }

  async alle<T extends BaseRecord>(typ: RecordTyp, projektId?: string | null): Promise<T[]> {
    const zeilen: Zeile[] =
      projektId === undefined
        ? await this.d.getAllFromIndex('records', 'typ', typ)
        : await this.d.getAllFromIndex('records', 'typProjekt', [typ, projektId ?? '']);
    return zeilen.map((z) => z.rec as T);
  }

  async hole<T extends BaseRecord>(id: string): Promise<T | undefined> {
    const z: Zeile | undefined = await this.d.get('records', id);
    return z?.rec as T | undefined;
  }

  async speichere(rec: BaseRecord, dirty: boolean) {
    const z: Zeile = {
      id: rec.id,
      typ: rec.typ,
      projektKey: rec.projektId ?? '',
      version: rec.version,
      dirty: dirty ? 1 : 0,
      rec,
    };
    await this.d.put('records', z);
  }

  async ungesynct() {
    const zeilen: Zeile[] = await this.d.getAllFromIndex('records', 'dirty', 1);
    return zeilen.map((z) => z.rec);
  }

  async alsSynctMarkieren(id: string, version: number) {
    const tx = this.d.transaction('records', 'readwrite');
    const z: Zeile | undefined = await tx.store.get(id);
    if (z && z.version === version) await tx.store.put({ ...z, dirty: 0 });
    await tx.done;
  }

  async holeStatus(id: string) {
    const z: Zeile | undefined = await this.d.get('records', id);
    return z ? { rec: z.rec, dirty: z.dirty === 1 } : undefined;
  }

  async holeMeta(key: string) {
    return (await this.d.get('meta', key)) as string | undefined;
  }

  async loescheMeta(key: string) {
    await this.d.delete('meta', key);
  }

  async metaMitPrefix(prefix: string) {
    const bereich = IDBKeyRange.bound(prefix, prefix + '\uffff');
    const tx = this.d.transaction('meta');
    const [keys, werte] = await Promise.all([tx.store.getAllKeys(bereich), tx.store.getAll(bereich)]);
    await tx.done;
    const r: Record<string, string> = {};
    keys.forEach((k, i) => (r[String(k)] = werte[i] as string));
    return r;
  }

  async setzeMeta(key: string, value: string) {
    await this.d.put('meta', value, key);
  }
}

export function erzeugeStore(): RecordStore {
  return new IdbStore();
}
