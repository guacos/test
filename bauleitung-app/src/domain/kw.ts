/**
 * Kalenderwochen nach ISO 8601 (Woche beginnt Montag, KW 1 enthält den ersten Donnerstag).
 * Alle Berechnungen in UTC, damit Sommer-/Winterzeit keine Rolle spielt.
 */

export interface KW {
  jahr: number;
  woche: number;
}

const TAG_MS = 86_400_000;

/** Kalenderdatum (lokale Zeit) als UTC-Mitternacht. */
function utcTag(d: Date): number {
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

/** ISO-KW eines Datums (lokales Kalenderdatum). */
export function isoKw(d: Date): KW {
  const t = new Date(utcTag(d));
  const wt = (t.getUTCDay() + 6) % 7; // Mo=0 … So=6
  t.setUTCDate(t.getUTCDate() - wt + 3); // Donnerstag derselben Woche
  const jahr = t.getUTCFullYear();
  const ersterDo = new Date(Date.UTC(jahr, 0, 4));
  const ersterDoWt = (ersterDo.getUTCDay() + 6) % 7;
  ersterDo.setUTCDate(ersterDo.getUTCDate() - ersterDoWt + 3);
  const woche = 1 + Math.round((t.getTime() - ersterDo.getTime()) / (7 * TAG_MS));
  return { jahr, woche };
}

/** Anzahl der ISO-Wochen eines Jahres (52 oder 53). Der 28.12. liegt immer in der letzten Woche. */
export function wochenImJahr(jahr: number): number {
  return isoKw(new Date(jahr, 11, 28)).woche;
}

export function istGueltig(k: KW): boolean {
  return Number.isInteger(k.woche) && k.woche >= 1 && k.woche <= wochenImJahr(k.jahr);
}

/** Montag der KW als UTC-Zeitstempel. */
export function montagUtc(k: KW): number {
  const jan4 = new Date(Date.UTC(k.jahr, 0, 4));
  const wt = (jan4.getUTCDay() + 6) % 7;
  return Date.UTC(k.jahr, 0, 4 - wt) + (k.woche - 1) * 7 * TAG_MS;
}

/** Montag der KW als lokales Datum. */
export function montag(k: KW): Date {
  const u = new Date(montagUtc(k));
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
}

/** Speicherschlüssel, z. B. "2026-W40". Sortiert sich alphabetisch = chronologisch. */
export function kwSchluessel(k: KW): string {
  return `${k.jahr}-W${String(k.woche).padStart(2, '0')}`;
}

export function ausSchluessel(s: string): KW | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(s);
  if (!m) return null;
  const k = { jahr: Number(m[1]), woche: Number(m[2]) };
  return istGueltig(k) ? k : null;
}

export function vergleicheKw(a: KW, b: KW): number {
  return a.jahr - b.jahr || a.woche - b.woche;
}

export function plusWochen(k: KW, n: number): KW {
  const u = new Date(montagUtc(k) + n * 7 * TAG_MS);
  return isoKw(new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()));
}

/**
 * Welche KW ist mit "kw40" gemeint? Regel: die KW mit dieser Nummer, die heute
 * am nächsten liegt (Vorjahr, dieses oder nächstes Jahr). Bei Gleichstand gewinnt
 * die Zukunft. Gibt es die Nummer in keinem der Jahre (z. B. 54), dann null.
 */
export function naechsteKw(woche: number, heute: Date = new Date()): KW | null {
  if (!Number.isInteger(woche) || woche < 1 || woche > 53) return null;
  const jetzt = isoKw(heute);
  const basis = montagUtc(jetzt);
  let beste: KW | null = null;
  let besterAbstand = Infinity;
  for (const jahr of [jetzt.jahr - 1, jetzt.jahr, jetzt.jahr + 1]) {
    const k = { jahr, woche };
    if (!istGueltig(k)) continue;
    const abstand = montagUtc(k) - basis;
    const betrag = Math.abs(abstand);
    if (betrag < besterAbstand || (betrag === besterAbstand && abstand > 0)) {
      beste = k;
      besterAbstand = betrag;
    }
  }
  return beste;
}

/** Anzeige: "KW 40", bei anderem Jahr als heute "KW 2/2027". */
export function kwText(k: KW, heute: Date = new Date()): string {
  return k.jahr === isoKw(heute).jahr ? `KW ${k.woche}` : `KW ${k.woche}/${k.jahr}`;
}

/** Anzeige direkt aus dem Schlüssel; unbekannt → "Unbekannt". */
export function kwTextAusSchluessel(s: string | null, heute: Date = new Date()): string {
  const k = s ? ausSchluessel(s) : null;
  return k ? kwText(k, heute) : 'Unbekannt';
}

/** Datum als "YYYY-MM-DD" (lokal). */
export function isoDatum(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
