/** Hilfen für Datumswerte im Format "YYYY-MM-DD" (lokale Zeit). */

export function heuteIso(jetzt: Date = new Date()): string {
  return `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, '0')}-${String(jetzt.getDate()).padStart(2, '0')}`;
}

export function istIsoDatum(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
}

export function ausIso(s: string): Date | null {
  if (!istIsoDatum(s)) return null;
  const [j, m, t] = s.split('-').map(Number);
  return new Date(j, m - 1, t, 12);
}

/** "2026-11-06" → "06.11.2026"; leer → "–" */
export function datumDe(iso: string | null | undefined): string {
  if (!iso) return '–';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** "06.11.2026", "6.11.26", "2026-11-06" → "2026-11-06"; ungültig → null */
export function parseDatum(eingabe: string): string | null {
  const t = eingabe.trim();
  if (!t) return null;
  if (istIsoDatum(t)) return t;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const jahr = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  const iso = `${jahr}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return istIsoDatum(iso) ? iso : null;
}

export function plusTage(iso: string, tage: number): string {
  const d = ausIso(iso) ?? new Date();
  d.setDate(d.getDate() + tage);
  return heuteIso(d);
}

const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function wochentagVon(iso: string): string {
  const d = ausIso(iso);
  return d ? TAGE[d.getDay()] : '';
}

/** "Dienstag, 10.11.2026" */
export function datumLang(iso: string): string {
  return `${wochentagVon(iso)}, ${datumDe(iso)}`;
}
