import type { BaseRecord, RecordTyp } from './types';

/** Legt die Metadaten eines neuen Datensatzes an. */
export function neuerDatensatz<T extends BaseRecord>(
  typ: T['typ'] & RecordTyp,
  projektId: string | null,
  felder: Omit<T, keyof BaseRecord>,
  autor: string,
  id: string,
  jetzt: Date = new Date(),
): T {
  const zeit = jetzt.toISOString();
  return {
    ...(felder as object),
    id,
    typ,
    projektId,
    erstelltVon: autor,
    erstelltAm: zeit,
    geaendertVon: autor,
    geaendertAm: zeit,
    version: 1,
    geloescht: false,
  } as T;
}

/** Übernimmt Änderungen und setzt Bearbeiter, Zeit und Version. */
export function geaenderterDatensatz<T extends BaseRecord>(
  alt: T,
  aenderungen: Partial<Omit<T, keyof BaseRecord>>,
  autor: string,
  jetzt: Date = new Date(),
): T {
  return {
    ...alt,
    ...aenderungen,
    geaendertVon: autor,
    geaendertAm: jetzt.toISOString(),
    version: alt.version + 1,
  };
}

/** Markiert einen Datensatz als gelöscht. */
export function geloeschterDatensatz<T extends BaseRecord>(alt: T, autor: string, jetzt: Date = new Date()): T {
  return { ...geaenderterDatensatz(alt, {}, autor, jetzt), geloescht: true };
}
