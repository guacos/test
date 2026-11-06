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

// ---------- Board ----------

export const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const;
export type Wochentag = (typeof WOCHENTAGE)[number];

export type Bereich = 'projektleitung' | 'bauleitung';

export const BEREICHE: Record<Bereich, { label: string; rubriken: readonly string[] }> = {
  projektleitung: { label: 'Projektleitung', rubriken: ['Bauherr', 'Kosten', 'Termine'] },
  bauleitung: { label: 'Bauleitung', rubriken: ['Nachunternehmer', 'Lieferungen', 'Planung', 'Baustelleneinrichtung'] },
};

/** Stand der KI-Ausformulierung eines Eintrags. */
export type KiStatus =
  | 'manuell' // ohne KI erstellt (KI aus im Projekt)
  | 'ausstehend' // KI erlaubt, aber noch nicht erreichbar → wird nachgeholt
  | 'fertig'; // von der KI ausformuliert

/** Eine angelegte Kalenderwoche (damit auch leere Wochen erhalten bleiben). */
export interface Woche extends BaseRecord {
  typ: 'woche';
  /** z. B. "2026-W40" */
  kw: string;
}

export interface Checkpunkt {
  id: string;
  text: string;
  erledigt: boolean;
}

/** Prüfkette je Vorgang: Vorleistung → Material/Lieferschein → Planstand → Qualität nach Ausführung */
export interface Pruefkette {
  vorleistung: boolean;
  material: boolean;
  planstand: boolean;
  qualitaet: boolean;
}

export interface BoardEintrag extends BaseRecord {
  typ: 'board';
  kw: string;
  bereich: Bereich;
  rubrik: string;
  titel: string;
  text: string;
  wochentag: Wochentag | null;
  checkpunkte: Checkpunkt[];
  pruefkette: Pruefkette;
  fotoIds: string[];
  notiz: string;
  /** Ursprüngliche Kurzeingabe (für das Nachholen der KI) */
  rohtext: string;
  ki: KiStatus;
  /** Phase 2: Lieferung als geliefert markiert (durch Lieferschein) */
  geliefert?: boolean;
}

// ---------- Fotos ----------

export const FOTO_ARTEN = ['Übersicht', 'Detail'] as const;
export type FotoArt = (typeof FOTO_ARTEN)[number];

/** Woher die KW eines Fotos stammt. */
export type KwQuelle = 'exif' | 'dateiname' | 'kamera' | 'manuell' | 'unbekannt';

export interface Foto extends BaseRecord {
  typ: 'foto';
  /** Schlüssel der lokalen Bilddatei */
  datei: string;
  breite: number;
  hoehe: number;
  /** Aufnahmezeitpunkt (ISO), falls bekannt */
  aufnahme: string | null;
  /** z. B. "2026-W45", null = Unbekannt */
  kw: string | null;
  kwQuelle: KwQuelle;
  /** null = noch nicht vergeben */
  gewerk: string | null;
  art: FotoArt | null;
  geschoss: string | null;
  tags: string[];
  notiz: string;
  originalName: string | null;
  /** Dateiname in OneDrive, wird beim Hochladen vergeben */
  oneDriveName: string | null;
  ki: KiStatus;
}

// ---------- Jour Fixe ----------

export interface Protokoll extends BaseRecord {
  typ: 'protokoll';
  nr: number;
  /** YYYY-MM-DD */
  datum: string;
  teilnehmer: string;
  status: 'entwurf' | 'abgeschlossen';
}

export interface Ergaenzung {
  id: string;
  /** YYYY-MM-DD */
  datum: string;
  text: string;
  /** In welchem Protokoll die Ergänzung entstanden ist (für die Farbe) */
  protokollNr: number;
}

export interface ProtokollPunkt extends BaseRecord {
  typ: 'protokollpunkt';
  protokollId: string;
  /** Gleich über alle Protokolle, in die der Punkt übernommen wurde */
  threadId: string;
  /** Protokoll-Nr., in der der Punkt zuerst auftauchte */
  ursprungNr: number;
  thema: string;
  beschreibung: string;
  verantwortlich: string;
  /** YYYY-MM-DD oder '' */
  frist: string;
  status: 'offen' | 'erledigt';
  fotoIds: string[];
  planausschnittIds: string[];
  ergaenzungen: Ergaenzung[];
  /** Sortierung innerhalb des Protokolls */
  reihenfolge: number;
  rohtext: string;
  ki: KiStatus;
}
