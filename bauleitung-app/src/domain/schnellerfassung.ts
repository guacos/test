/**
 * Auswertung der Kurzeingabe (ohne KI, rein nach festen Regeln):
 *  - "jf …" am Anfang → Jour-Fixe-Punkt (der Rest ist der Text, "kw…" bleibt unverändert)
 *  - "kw40" irgendwo → Eintrag in KW 40, "kw40" wird aus dem Text entfernt
 *  - Wochentag im Text → Markierung (Text bleibt unverändert)
 */
import { naechsteKw, type KW } from './kw';
import { WOCHENTAGE, type Wochentag } from './types';

export interface Analyse {
  /** Bereinigter Text */
  text: string;
  jf: boolean;
  /** Ziel-KW aus "kw40" (null = keine Angabe) */
  kw: KW | null;
  /** Fehler, z. B. "KW 54 gibt es nicht" */
  kwFehler: string | null;
  wochentag: Wochentag | null;
}

const JF = /^\s*jf(?![a-zäöüß0-9])[\s:.,-]*/i;
const KW_TOKEN = /(^|[^a-zäöüß0-9])kw\s?-?\s?(\d{1,2})(?![0-9])/i;
const BUCHSTABE = 'a-zäöüß';
const WOCHENTAG = new RegExp(
  `(^|[^${BUCHSTABE}])(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)s?(?![${BUCHSTABE}])`,
  'i',
);

function bereinige(s: string): string {
  return s.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
}

/** Erkennt einen Wochentag als ganzes Wort ("Montage" ist kein Montag). */
export function erkenneWochentag(text: string): Wochentag | null {
  const m = WOCHENTAG.exec(text);
  if (!m) return null;
  const name = m[2].toLowerCase();
  return WOCHENTAGE.find((w) => w.toLowerCase() === name) ?? null;
}

export function analysiere(eingabe: string, heute: Date = new Date()): Analyse {
  const roh = eingabe.trim();
  const jfMatch = JF.exec(roh);
  if (jfMatch) {
    const text = bereinige(roh.slice(jfMatch[0].length));
    return { text, jf: true, kw: null, kwFehler: null, wochentag: erkenneWochentag(text) };
  }

  let text = roh;
  let kw: KW | null = null;
  let kwFehler: string | null = null;
  const m = KW_TOKEN.exec(roh);
  if (m) {
    const nr = Number(m[2]);
    kw = naechsteKw(nr, heute);
    if (!kw) kwFehler = `KW ${nr} gibt es nicht.`;
    text = roh.slice(0, m.index) + m[1] + ' ' + roh.slice(m.index + m[0].length);
  }
  text = bereinige(text);
  return { text, jf: false, kw, kwFehler, wochentag: erkenneWochentag(text) };
}

export type Ziel = 'board' | 'jourfixe' | 'foto';

/** Ziel ohne KI: "jf" → Jour Fixe; nur Foto ohne Text → nur Foto; sonst Board. */
export function zielOhneKi(a: Pick<Analyse, 'jf' | 'text'>, hatFoto: boolean): Ziel {
  if (a.jf) return 'jourfixe';
  if (!a.text && hatFoto) return 'foto';
  return 'board';
}

/** Erster Buchstabe groß (für Titel ohne KI). */
export function grossAnfang(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
