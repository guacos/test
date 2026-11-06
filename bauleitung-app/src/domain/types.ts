/**
 * Datenmodell der App.
 *
 * Jeder Datensatz ist ein eigenständiges Dokument mit Ersteller und
 * Änderungszeit. So kann später jeder Datensatz als eigene kleine Datei
 * in OneDrive liegen (siehe Sync-Konzept in der README).
 */

/** Alle Datensatz-Typen. Phase 2/3 ergänzen hier weitere Typen. */
export type RecordTyp =
  | 'projekt'
  | 'woche'
  | 'board'
  | 'foto'
  | 'protokoll'
  | 'protokollpunkt'
  | 'einstellungen';

export interface BaseRecord {
  id: string;
  typ: RecordTyp;
  /** Projekt, zu dem der Datensatz gehört. Bei einem Projekt: die eigene id. null = projektübergreifend. */
  projektId: string | null;
  erstelltVon: string;
  /** ISO-Zeitstempel */
  erstelltAm: string;
  geaendertVon: string;
  geaendertAm: string;
  /** Wird bei jeder Änderung um 1 erhöht. */
  version: number;
  /** Gelöschte Datensätze werden nur markiert, damit das Löschen synchronisiert werden kann. */
  geloescht: boolean;
}

export interface Projekt extends BaseRecord {
  typ: 'projekt';
  nr: string;
  name: string;
  bauherr: string;
  adresse: string;
  /** KI-Schalter je Projekt. Standard: AUS. */
  kiErlaubt: boolean;
}

/** Felder, die der Nutzer beim Projekt eingibt. */
export type ProjektDaten = Pick<Projekt, 'nr' | 'name' | 'bauherr' | 'adresse' | 'kiErlaubt'>;
