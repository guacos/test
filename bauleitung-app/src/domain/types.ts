/**
 * Datenmodell der App.
 *
 * Jeder Datensatz ist ein eigenständiges Dokument mit Ersteller und
 * Änderungszeit. So liegt jeder Datensatz als eigene kleine Datei in
 * OneDrive (siehe Sync-Konzept in der README).
 */

/** Alle Datensatz-Typen. */
export type RecordTyp =
  | 'projekt'
  | 'woche'
  | 'board'
  | 'foto'
  | 'protokoll'
  | 'protokollpunkt'
  | 'einstellungen'
  | 'firma'
  | 'bautag'
  | 'mangel'
  | 'plan'
  | 'lieferschein'
  | 'unterlage';

/** Typen, die je Projekt in OneDrive unter _daten/{typ}/ liegen. */
export const PROJEKT_TYPEN: RecordTyp[] = [
  'woche',
  'board',
  'foto',
  'protokoll',
  'protokollpunkt',
  'firma',
  'bautag',
  'mangel',
  'plan',
  'lieferschein',
  'unterlage',
];

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

/** Felder eines Datensatzes ohne die Verwaltungsfelder. */
export type Inhalt<T extends BaseRecord> = Omit<T, keyof BaseRecord>;

// ---------- Projekt ----------

export interface Projekt extends BaseRecord {
  typ: 'projekt';
  nr: string;
  name: string;
  bauherr: string;
  adresse: string;
  /** KI-Schalter je Projekt. Standard: AUS. */
  kiErlaubt: boolean;
  /** Wetter fürs Bautagebuch automatisch abrufen (sendet nur Koordinaten). Standard: AUS. */
  wetterAuto?: boolean;
  /** Standort der Baustelle (für das Wetter) */
  lat?: number | null;
  lon?: number | null;
}

/** Felder, die der Nutzer beim Projekt eingibt. */
export type ProjektDaten = Pick<Projekt, 'nr' | 'name' | 'bauherr' | 'adresse' | 'kiErlaubt'> &
  Partial<Pick<Projekt, 'wetterAuto' | 'lat' | 'lon'>>;

// ---------- Einstellungen (projektübergreifend) ----------

export const STANDARD_GEWERKE = [
  'Erdarbeiten',
  'Rohbau',
  'Estrich',
  'Trockenbau',
  'Elektro',
  'Sanitär',
  'Heizung/Lüftung',
  'Gebäudeautomation',
  'Brandschutz',
  'Erdleitungen',
  'Fassade',
  'Dach',
  'Maler',
  'Fliesen',
  'Bodenbelag',
  'Baustelleneinrichtung',
  'Sonstiges',
];

export const STANDARD_GESCHOSSE = ['EG', '1.OG', 'Halle', 'Außenanlage'];

/** Feste ID: es gibt genau einen Einstellungs-Datensatz. */
export const EINSTELLUNGEN_ID = 'einstellungen';

export interface Einstellungen extends BaseRecord {
  typ: 'einstellungen';
  gewerke: string[];
  geschosse: string[];
}

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
  | 'fertig'; // von der KI bearbeitet

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

export const PRUEFKETTE: { key: keyof Pruefkette; label: string }[] = [
  { key: 'vorleistung', label: 'Vorleistung' },
  { key: 'material', label: 'Material / Lieferschein' },
  { key: 'planstand', label: 'Planstand' },
  { key: 'qualitaet', label: 'Qualität nach Ausführung' },
];

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
  /** Lieferung als geliefert markiert (durch einen Lieferschein oder von Hand) */
  geliefert?: boolean;
}

// ---------- Fotos ----------

export const FOTO_ARTEN = ['Übersicht', 'Detail'] as const;
export type FotoArt = (typeof FOTO_ARTEN)[number];

/** Woher die KW eines Fotos stammt. */
export type KwQuelle = 'exif' | 'dateiname' | 'kamera' | 'manuell' | 'unbekannt';

/**
 * Wohin das Bild in OneDrive gehört:
 *  fotos        → 02_Fotos/{Jahr}_KW{nn}/        (Fotodokumentation)
 *  anhang       → 03_Protokolle/Anhaenge/         (Planausschnitte im Jour Fixe)
 *  lieferschein → 07_Lieferscheine/{Jahr}_KW{nn}/
 *  plan         → 05_Maengel/_Grundrisse/         (Grundrisse für Mängel-Pins)
 */
export type FotoAblage = 'fotos' | 'anhang' | 'lieferschein' | 'plan';

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
  /** fehlt = 'fotos' */
  ablage?: FotoAblage;
  /** Pfad in OneDrive relativ zum Projektordner; wird beim Hochladen vergeben */
  oneDrivePfad?: string | null;
  /** Gewerk/Art stammen von der KI und wurden noch nicht bestätigt */
  kiVorschlag?: boolean;
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
  /** Laufende Nr. innerhalb des Ursprungsprotokolls → feste Punkt-Nr. "3.02" */
  lfdNr?: number;
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

// ---------- Firmen (NU-Adressbuch) ----------

export interface Firma extends BaseRecord {
  typ: 'firma';
  name: string;
  gewerk: string;
  ansprechpartner: string;
  telefon: string;
  email: string;
  notiz: string;
}

// ---------- Bautagebuch ----------

export interface Wetter {
  /** z. B. "Regen", "trocken" */
  beschreibung: string;
  tempMin: number | null;
  tempMax: number | null;
  /** mm */
  niederschlag: number | null;
  /** km/h */
  windMax: number | null;
  quelle: 'manuell' | 'dwd';
}

export interface FirmaAnwesenheit {
  firmaId: string | null;
  name: string;
  anzahl: number;
}

export interface Bautag extends BaseRecord {
  typ: 'bautag';
  /** YYYY-MM-DD, je Projekt nur ein Eintrag pro Tag */
  datum: string;
  wetter: Wetter | null;
  firmen: FirmaAnwesenheit[];
  notiz: string;
  fotoIds: string[];
}

// ---------- Mängel ----------

export interface Plan extends BaseRecord {
  typ: 'plan';
  name: string;
  geschoss: string;
  /** Bild des Grundrisses (Foto-Datensatz mit ablage 'plan') */
  fotoId: string;
}

export interface Mangel extends BaseRecord {
  typ: 'mangel';
  /** laufende Nummer im Projekt */
  nr: number;
  titel: string;
  beschreibung: string;
  firmaId: string | null;
  firmaName: string;
  /** Geschoss/Bereich als Text */
  ort: string;
  /** YYYY-MM-DD oder '' */
  frist: string;
  status: 'offen' | 'erledigt';
  /** YYYY-MM-DD oder '' */
  erledigtAm: string;
  fotoIds: string[];
  planId: string | null;
  /** Position im Grundriss, 0..1 von links/oben */
  pin: { x: number; y: number } | null;
}

// ---------- Lieferscheine ----------

export interface Lieferschein extends BaseRecord {
  typ: 'lieferschein';
  fotoId: string | null;
  lieferant: string;
  /** YYYY-MM-DD oder '' */
  datum: string;
  nummer: string;
  material: string;
  menge: string;
  firmaId: string | null;
  firmaName: string;
  /** Kurzprüfung */
  mengeOk: boolean | null;
  schaeden: string;
  lagerort: string;
  /** Verknüpfte geplante Lieferung im Board */
  boardEintragId: string | null;
  ki: KiStatus;
}

// ---------- Unterlagen (Pläne, LV, Verträge) ----------

export const UNTERLAGEN_ARTEN = ['Plan', 'LV', 'Vertrag', 'Sonstiges'] as const;
export type UnterlagenArt = (typeof UNTERLAGEN_ARTEN)[number];

export interface Unterlage extends BaseRecord {
  typ: 'unterlage';
  /** Dateiname, z. B. "Grundriss EG.pdf" */
  name: string;
  /** Schlüssel der lokalen Datei (liegt nur vor, wenn sie auf dieses Gerät geladen wurde) */
  datei: string;
  mime: string;
  /** Größe in Bytes, falls bekannt */
  groesse: number | null;
  art: UnterlagenArt;
  /** Plan-Nr. (frei); Unterlagen mit gleicher Plan-Nr. gelten als verschiedene Stände desselben Plans */
  planNr: string;
  /** Planindex, z. B. "C" oder "03" */
  index: string;
  notiz: string;
  /** Pfad in OneDrive relativ zu _Kernteam/{Projekt}/, z. B. "01_Unterlagen/Grundriss EG.pdf" */
  oneDrivePfad: string | null;
}
