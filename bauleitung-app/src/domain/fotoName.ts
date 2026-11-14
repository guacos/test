/**
 * Sprechende Dateinamen und Ordner für Fotos in OneDrive, z. B.
 *   02_Fotos/2026_KW45/2026-11-06_KW45_Trockenbau_Detail_1OG_001.jpg
 */
import { ausSchluessel } from './kw';
import type { Foto } from './types';

const VERBOTEN = /["*:<>?/\\|]/g;

/** Einzelner Namensteil: keine Leerzeichen, keine verbotenen Zeichen, keine Punkte, keine Unterstriche. */
export function nameTeil(text: string): string {
  return text
    .trim()
    .replace(VERBOTEN, '-')
    .replace(/[._]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Ordner je Kalenderwoche: "2026_KW45" (mit Jahr, damit sich Jahre nicht mischen); unbekannt → "KW_unbekannt" */
export function kwOrdner(kw: string | null): string {
  const k = kw ? ausSchluessel(kw) : null;
  return k ? `${k.jahr}_KW${String(k.woche).padStart(2, '0')}` : 'KW_unbekannt';
}

type FotoKern = Pick<Foto, 'aufnahme' | 'kw' | 'gewerk' | 'art' | 'geschoss' | 'ablage'>;

/** Namensanfang ohne laufende Nummer: "2026-11-06_KW45_Trockenbau_Detail_1OG" */
export function fotoBasisName(f: FotoKern): string {
  const k = f.kw ? ausSchluessel(f.kw) : null;
  let datum = 'ohne-Datum';
  if (f.aufnahme) {
    const d = new Date(f.aufnahme);
    if (!isNaN(d.getTime())) {
      datum = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  }
  const teile = [datum, k ? `KW${String(k.woche).padStart(2, '0')}` : 'KW-unbekannt'];
  if (f.ablage === 'lieferschein') {
    teile.push('Lieferschein');
  } else if (f.ablage === 'anhang') {
    teile.push('Anhang');
  } else if (f.ablage === 'plan') {
    teile.push('Grundriss');
  } else {
    teile.push(nameTeil(f.gewerk ?? '') || 'ohne-Gewerk');
    teile.push(nameTeil(f.art ?? '') || 'ohne-Art');
  }
  const geschoss = nameTeil(f.geschoss ?? '');
  if (geschoss) teile.push(geschoss);
  return teile.join('_');
}

/** Ordner relativ zum Projektordner. */
export function fotoOrdner(f: Pick<Foto, 'kw' | 'ablage'>): string {
  switch (f.ablage) {
    case 'anhang':
      return '03_Protokolle/Anhaenge';
    case 'lieferschein':
      return `07_Lieferscheine/${kwOrdner(f.kw)}`;
    case 'plan':
      return '05_Maengel/_Grundrisse';
    default:
      return `02_Fotos/${kwOrdner(f.kw)}`;
  }
}

export function mitNummer(basis: string, nr: number): string {
  return `${basis}_${String(nr).padStart(3, '0')}.jpg`;
}

/** Nächste freie laufende Nummer für diesen Namensanfang im Ordner. */
export function naechsteNummer(basis: string, vorhandeneNamen: string[]): number {
  let max = 0;
  const praefix = `${basis}_`.toLowerCase();
  for (const n of vorhandeneNamen) {
    const klein = n.toLowerCase();
    if (!klein.startsWith(praefix)) continue;
    const m = /^(\d{3,})\.jpe?g$/.exec(klein.slice(praefix.length));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/** Passt der vorhandene OneDrive-Pfad noch zu den aktuellen Tags? (sonst umbenennen/verschieben) */
export function pfadPasst(f: FotoKern & Pick<Foto, 'oneDrivePfad'>): boolean {
  if (!f.oneDrivePfad) return false;
  const i = f.oneDrivePfad.lastIndexOf('/');
  const ordner = f.oneDrivePfad.slice(0, i);
  const name = f.oneDrivePfad.slice(i + 1);
  return ordner === fotoOrdner(f) && new RegExp(`^${escapeRegex(fotoBasisName(f))}_\\d{3,}\\.jpg$`).test(name);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
