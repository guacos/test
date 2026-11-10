import { neueId as neueIdStandard } from '../lib/id';
import { geaenderterDatensatz, geloeschterDatensatz, neuerDatensatz } from '../domain/record';
import type { BaseRecord, Inhalt, RecordTyp } from '../domain/types';
import type { RecordStore } from './RecordStore';

/**
 * Zentrale Stelle für alle Schreibzugriffe. Jede Änderung wird lokal
 * gespeichert und als "noch nicht abgeglichen" markiert.
 */
export class Repo {
  /** Wird nach jeder lokalen Änderung aufgerufen (stößt den Abgleich an). */
  beiAenderung: (() => void) | null = null;

  constructor(
    readonly store: RecordStore,
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

  /** Datensatz holen, gelöschte gelten als nicht vorhanden. */
  async holeAktiv<T extends BaseRecord>(id: string | null | undefined): Promise<T | undefined> {
    if (!id) return undefined;
    const r = await this.store.hole<T>(id);
    return r && !r.geloescht ? r : undefined;
  }

  async neu<T extends BaseRecord>(typ: T['typ'], projektId: string | null, felder: Inhalt<T>, festeId?: string): Promise<T> {
    const id = festeId ?? this.neueId();
    // Ein Projekt gehört zu sich selbst.
    const pid = typ === 'projekt' ? id : projektId;
    const rec = neuerDatensatz<T>(typ, pid, felder, this.autor(), id);
    await this.store.speichere(rec, true);
    this.beiAenderung?.();
    return rec;
  }

  async aendere<T extends BaseRecord>(alt: T, aenderungen: Partial<Inhalt<T>>): Promise<T> {
    const rec = geaenderterDatensatz(alt, aenderungen, this.autor());
    await this.store.speichere(rec, true);
    this.beiAenderung?.();
    return rec;
  }

  /** Wie aendere, liest aber vorher den aktuellen Stand (gegen veraltete Kopien in der Oberfläche). */
  async aendereAktuell<T extends BaseRecord>(id: string, aenderung: (akt: T) => Partial<Inhalt<T>>): Promise<T | undefined> {
    const akt = await this.holeAktiv<T>(id);
    if (!akt) return undefined;
    return this.aendere(akt, aenderung(akt));
  }

  async loesche<T extends BaseRecord>(alt: T): Promise<T> {
    const rec = geloeschterDatensatz(alt, this.autor());
    await this.store.speichere(rec, true);
    this.beiAenderung?.();
    return rec;
  }

  holeMeta(key: string) {
    return this.store.holeMeta(key);
  }

  setzeMeta(key: string, value: string) {
    return this.store.setzeMeta(key, value);
  }
}
