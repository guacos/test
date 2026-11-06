import { neueId as neueIdStandard } from '../lib/id';
import { geaenderterDatensatz, geloeschterDatensatz, neuerDatensatz } from '../domain/record';
import type { BaseRecord, RecordTyp } from '../domain/types';
import type { RecordStore } from './RecordStore';

/**
 * Zentrale Stelle für alle Schreibzugriffe. Jede Änderung wird lokal
 * gespeichert und als "noch nicht abgeglichen" markiert.
 */
export class Repo {
  constructor(
    private store: RecordStore,
    private autor: () => string,
    private neueId: () => string = neueIdStandard,
  ) {}

  async alle<T extends BaseRecord>(typ: RecordTyp, projektId?: string | null): Promise<T[]> {
    const liste = await this.store.alle<T>(typ, projektId);
    return liste.filter((r) => !r.geloescht);
  }

  hole<T extends BaseRecord>(id: string) {
    return this.store.hole<T>(id);
  }

  async neu<T extends BaseRecord>(typ: T['typ'], projektId: string | null, felder: Omit<T, keyof BaseRecord>): Promise<T> {
    const id = this.neueId();
    // Ein Projekt gehört zu sich selbst.
    const pid = typ === 'projekt' ? id : projektId;
    const rec = neuerDatensatz<T>(typ, pid, felder, this.autor(), id);
    await this.store.speichere(rec, true);
    return rec;
  }

  async aendere<T extends BaseRecord>(alt: T, aenderungen: Partial<Omit<T, keyof BaseRecord>>): Promise<T> {
    const rec = geaenderterDatensatz(alt, aenderungen, this.autor());
    await this.store.speichere(rec, true);
    return rec;
  }

  async loesche<T extends BaseRecord>(alt: T): Promise<T> {
    const rec = geloeschterDatensatz(alt, this.autor());
    await this.store.speichere(rec, true);
    return rec;
  }

  holeMeta(key: string) {
    return this.store.holeMeta(key);
  }

  setzeMeta(key: string, value: string) {
    return this.store.setzeMeta(key, value);
  }
}
