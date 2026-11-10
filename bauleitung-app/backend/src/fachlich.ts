/**
 * Fachliche Vorgaben für die KI: Rubriken, Wochentage, Anweisungen (aus dem Prototyp übernommen).
 * Muss zu src/domain/types.ts der App passen.
 */
import { z } from 'zod';

export const RUBRIKEN = {
  projektleitung: ['Bauherr', 'Kosten', 'Termine'],
  bauleitung: ['Nachunternehmer', 'Lieferungen', 'Planung', 'Baustelleneinrichtung'],
} as const;

export const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const;
const ALLE_RUBRIKEN = [...RUBRIKEN.projektleitung, ...RUBRIKEN.bauleitung];

// ---------- Board ----------

export const BOARD_SYSTEM =
  'Du bist Assistent eines Bauleiters TGA/Schlüsselfertigbau in Deutschland. ' +
  'Du bekommst einen kurzen Stichworttext zu einem Bauvorgang. ' +
  'Ordne ihn genau einem Bereich und einer Rubrik zu:\n' +
  'Bereich "projektleitung" mit Rubriken: Bauherr, Kosten, Termine.\n' +
  'Bereich "bauleitung" mit Rubriken: Nachunternehmer, Lieferungen, Planung, Baustelleneinrichtung.\n' +
  'Formuliere einen kurzen, klaren Titel (max. 8 Wörter) und einen ausformulierten Satz als Beschreibung. ' +
  'Erzeuge zusätzlich 2 bis 5 konkrete, baupraktische Checkpunkte, die sich aus dem Vorgang ergeben ' +
  '(z. B. bei einer Anlieferung: Zuwegung prüfen, Lagerfläche definieren, Entladung organisieren, Vorleistung/Untergrund prüfen; ' +
  'bei Ausführungsarbeiten: Planunterlagen auf aktuellen Stand prüfen, Vorleistung prüfen, Qualitätsprüfung nach Ausführung). ' +
  'Erfinde keine Fakten, die nicht im Text stehen (keine Mengen, Firmen, Termine). ' +
  'Wird im Text ein Wochentag genannt (Montag bis Sonntag), gib ihn an, sonst "keiner".';

const boardSchemaJson = {
  type: 'object',
  properties: {
    bereich: { type: 'string', enum: ['projektleitung', 'bauleitung'] },
    rubrik: { type: 'string', enum: ALLE_RUBRIKEN },
    titel: { type: 'string' },
    beschreibung: { type: 'string' },
    checkpunkte: { type: 'array', items: { type: 'string' } },
    wochentag: { type: 'string', enum: [...WOCHENTAGE, 'keiner'] },
  },
  required: ['bereich', 'rubrik', 'titel', 'beschreibung', 'checkpunkte', 'wochentag'],
  additionalProperties: false,
} as const;

export const BoardAntwort = z
  .object({
    bereich: z.enum(['projektleitung', 'bauleitung']),
    rubrik: z.string(),
    titel: z.string().trim().min(1),
    beschreibung: z.string().trim().min(1),
    checkpunkte: z.array(z.string().trim().min(1)).min(1).max(8),
    wochentag: z.enum([...WOCHENTAGE, 'keiner']),
  })
  .refine((a) => (RUBRIKEN[a.bereich] as readonly string[]).includes(a.rubrik), 'Rubrik passt nicht zum Bereich')
  .transform((a) => ({
    ...a,
    // Titel hart auf 8 Wörter begrenzen, Checkpunkte auf 5
    titel: a.titel.split(/\s+/).slice(0, 8).join(' '),
    checkpunkte: a.checkpunkte.slice(0, 5),
    wochentag: a.wochentag === 'keiner' ? null : a.wochentag,
  }));
export type BoardAntwort = z.output<typeof BoardAntwort>;

// ---------- Jour Fixe ----------

export const JF_SYSTEM =
  'Du bist Assistent eines Bauleiters und formulierst Stichpunkte für ein Jour-Fixe-Protokoll aus. ' +
  'Du bekommst einen kurzen Stichworttext. Formuliere ein kurzes, klares Thema (max. 8 Wörter) und ' +
  'einen ausformulierten, sachlichen Satz als Beschreibung, wie er in einem Bauprotokoll stehen würde. ' +
  'Erzeuge KEINE Checkliste und KEINE Aufgabenliste, nur Thema und Beschreibung. ' +
  'Erfinde keine Fakten, die nicht im Text stehen.';

const jfSchemaJson = {
  type: 'object',
  properties: { thema: { type: 'string' }, beschreibung: { type: 'string' } },
  required: ['thema', 'beschreibung'],
  additionalProperties: false,
} as const;

export const JfAntwort = z.object({ thema: z.string().trim().min(1), beschreibung: z.string().trim().min(1) });
export type JfAntwort = z.output<typeof JfAntwort>;

// ---------- Schnellerfassung: Ziel entscheiden ----------

export const ERFASSUNG_SYSTEM =
  'Du bist Assistent eines Bauleiters TGA/Schlüsselfertigbau in Deutschland. ' +
  'Er erfasst unterwegs kurze Notizen, manchmal mit Foto. Entscheide das Ziel:\n' +
  '- "board": eine Aufgabe oder ein Vorgang für die Wochenplanung (Lieferung, Nachunternehmer, Planung, Termin, Kosten …)\n' +
  '- "jourfixe": ein Punkt, der in der nächsten Baubesprechung (Jour Fixe) mit allen Beteiligten besprochen werden soll\n' +
  '- "foto": nur Fotodokumentation, der Text beschreibt lediglich das Foto\n' +
  'Fülle danach "board" ODER "jourfixe" passend zum Ziel aus; das jeweils andere Objekt füllst du ebenfalls, ' +
  'es wird aber ignoriert.\n\n' +
  'Regeln für "board":\n' +
  BOARD_SYSTEM +
  '\n\nRegeln für "jourfixe":\n' +
  JF_SYSTEM;

const erfassungSchemaJson = {
  type: 'object',
  properties: {
    ziel: { type: 'string', enum: ['board', 'jourfixe', 'foto'] },
    board: boardSchemaJson,
    jourfixe: jfSchemaJson,
  },
  required: ['ziel', 'board', 'jourfixe'],
  additionalProperties: false,
} as const;

export const ErfassungAntwort = z.object({
  ziel: z.enum(['board', 'jourfixe', 'foto']),
  board: BoardAntwort,
  jourfixe: JfAntwort,
});
export type ErfassungAntwort = z.output<typeof ErfassungAntwort>;

// ---------- Fotos taggen ----------

export const ARTEN = ['Übersicht', 'Detail'] as const;

export function fotoSystem(gewerke: string[]): string {
  return (
    'Du bist Assistent eines Bauleiters und taggst Baustellenfotos. ' +
    `Wähle GENAU ein Gewerk aus dieser Liste: ${gewerke.join(', ')}. ` +
    'Wähle zusätzlich "Übersicht" (allgemeine Aufnahme eines Raums oder Bereichs, z. B. gespachtelte Räume) oder ' +
    '"Detail" (Nahaufnahme eines einzelnen Bauteils, z. B. Revisionsklappe, Anschluss, Leitung). ' +
    'Beurteile nur, was auf dem Foto zu sehen ist.'
  );
}

export function fotoSchema(gewerke: string[]) {
  return {
    type: 'object',
    properties: {
      gewerk: { type: 'string', enum: gewerke },
      art: { type: 'string', enum: [...ARTEN] },
    },
    required: ['gewerk', 'art'],
    additionalProperties: false,
  };
}

export function fotoPruefung(gewerke: string[]) {
  return z.object({
    gewerk: z.string().refine((g) => gewerke.includes(g), 'Gewerk nicht in der Liste'),
    art: z.enum(ARTEN),
  });
}

// ---------- Lieferschein lesen ----------

export const LIEFERSCHEIN_SYSTEM =
  'Du liest das Foto eines Lieferscheins von einer Baustelle in Deutschland. ' +
  'Gib Lieferant (Firmenname des Absenders), Datum des Lieferscheins im Format JJJJ-MM-TT, ' +
  'Lieferschein-Nummer, Material (kurze Aufzählung der Positionen) und Menge (mit Einheit) zurück. ' +
  'Was nicht eindeutig lesbar ist, lässt du als leeren Text. Erfinde nichts und rate nicht.';

const lieferscheinSchemaJson = {
  type: 'object',
  properties: {
    lieferant: { type: 'string' },
    datum: { type: 'string' },
    nummer: { type: 'string' },
    material: { type: 'string' },
    menge: { type: 'string' },
  },
  required: ['lieferant', 'datum', 'nummer', 'material', 'menge'],
  additionalProperties: false,
} as const;

export const LieferscheinAntwort = z
  .object({
    lieferant: z.string(),
    datum: z.string(),
    nummer: z.string(),
    material: z.string(),
    menge: z.string(),
  })
  .transform((a) => ({
    lieferant: a.lieferant.trim(),
    // nur ein echtes Datum durchlassen
    datum: /^\d{4}-\d{2}-\d{2}$/.test(a.datum.trim()) ? a.datum.trim() : '',
    nummer: a.nummer.trim(),
    material: a.material.trim(),
    menge: a.menge.trim(),
  }));

export const LIEFERSCHEIN = { system: LIEFERSCHEIN_SYSTEM, schema: lieferscheinSchemaJson, pruefung: LieferscheinAntwort };

export const AUFGABEN = {
  board: { system: BOARD_SYSTEM, schema: boardSchemaJson, pruefung: BoardAntwort },
  jourfixe: { system: JF_SYSTEM, schema: jfSchemaJson, pruefung: JfAntwort },
  erfassung: { system: ERFASSUNG_SYSTEM, schema: erfassungSchemaJson, pruefung: ErfassungAntwort },
} as const;
export type Aufgabe = keyof typeof AUFGABEN;

/** Eingabe der App. Nur der Kurztext – keine Projektdaten. */
export const Anfrage = z.object({
  text: z.string().trim().min(1).max(2000),
  hatFoto: z.boolean().optional(),
});

/** Verkleinertes JPEG als Base64 (höchstens ca. 3 MB). */
const Bild = z
  .string()
  .min(100)
  .max(4_000_000)
  .regex(/^[A-Za-z0-9+/=]+$/);

export const FotoAnfrage = z.object({
  bild: Bild,
  gewerke: z.array(z.string().trim().min(1).max(60)).min(1).max(80),
});

export const LieferscheinAnfrage = z.object({ bild: Bild });
