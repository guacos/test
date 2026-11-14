/**
 * Unterlagen: Welcher Stand eines Plans ist der aktuelle?
 * Regel: Unterlagen mit gleicher Plan-Nr. sind Stände desselben Plans; aktuell ist der höchste Index.
 * Ohne Plan-Nr. gilt eine Unterlage immer als aktuell.
 */
import type { Unterlage } from './types';

/** Vergleicht Planindizes: "" < "A" < "B" < "AA", "2" < "10", "a" = "A". */
export function vergleicheIndex(a: string, b: string): number {
  const x = a.trim().toUpperCase();
  const y = b.trim().toUpperCase();
  if (x === y) return 0;
  if (!x) return -1;
  if (!y) return 1;
  const zx = /^\d+$/.test(x);
  const zy = /^\d+$/.test(y);
  if (zx && zy) return Number(x) - Number(y);
  // reine Buchstabenfolgen: kürzere zuerst (Z < AA), sonst alphabetisch
  if (/^[A-Z]+$/.test(x) && /^[A-Z]+$/.test(y) && x.length !== y.length) return x.length - y.length;
  return x.localeCompare(y, 'de', { numeric: true });
}

type Kern = Pick<Unterlage, 'id' | 'planNr' | 'index' | 'geaendertAm'>;

/** IDs der Unterlagen, die durch einen neueren Index ersetzt sind. */
export function veralteteIds(unterlagen: Kern[]): Set<string> {
  const beste = new Map<string, Kern>();
  for (const u of unterlagen) {
    const nr = u.planNr.trim().toLowerCase();
    if (!nr) continue;
    const b = beste.get(nr);
    const v = b ? vergleicheIndex(u.index, b.index) : 1;
    if (!b || v > 0 || (v === 0 && u.geaendertAm > b.geaendertAm)) beste.set(nr, u);
  }
  const alt = new Set<string>();
  for (const u of unterlagen) {
    const nr = u.planNr.trim().toLowerCase();
    if (nr && beste.get(nr)!.id !== u.id) alt.add(u.id);
  }
  return alt;
}

export function aktuelleUnterlagen<T extends Kern>(unterlagen: T[]): T[] {
  const alt = veralteteIds(unterlagen);
  return unterlagen.filter((u) => !alt.has(u.id));
}

/** Anzeige "Plan-Nr. A-101 · Index C" */
export function planText(u: Pick<Unterlage, 'planNr' | 'index'>): string {
  return [u.planNr ? `Plan-Nr. ${u.planNr}` : '', u.index ? `Index ${u.index}` : ''].filter(Boolean).join(' · ');
}

export function groesseText(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Höchstgrenze für eine Frage an die KI (Summe der PDFs). */
export const MAX_FRAGE_BYTES = 20 * 1024 * 1024;

/** Dateiname ohne Zeichen, die OneDrive nicht erlaubt. */
export function sichererDateiname(name: string): string {
  return name.replace(/["*:<>?/\\|]/g, '-').replace(/\s+/g, ' ').trim() || 'Unterlage';
}

/** "Plan.pdf" → "Plan (2).pdf" */
export function mitZaehler(name: string, n: number): string {
  if (n <= 1) return name;
  const i = name.lastIndexOf('.');
  return i > 0 ? `${name.slice(0, i)} (${n})${name.slice(i)}` : `${name} (${n})`;
}

export function mimeVon(name: string): string {
  const e = name.toLowerCase().split('.').pop();
  return e === 'pdf' ? 'application/pdf' : e === 'png' ? 'image/png' : e === 'jpg' || e === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
}

export function istUnterlagenDatei(name: string): boolean {
  return /\.(pdf|png|jpe?g)$/i.test(name);
}
