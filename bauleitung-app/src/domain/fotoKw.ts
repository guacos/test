/**
 * Kalenderwoche eines Fotos:
 *  1. aus dem EXIF-Aufnahmedatum
 *  2. sonst aus einem Datum im Dateinamen (IMG_20261106…, 2026-11-06…)
 *  3. sonst "Unbekannt"
 * Bei einer Aufnahme direkt mit der App-Kamera ist der Aufnahmezeitpunkt "jetzt" bekannt.
 */
import { isoKw, kwSchluessel } from './kw';
import type { KwQuelle } from './types';

export interface FotoZeit {
  /** ISO-Zeitstempel oder null */
  aufnahme: string | null;
  kw: string | null;
  quelle: KwQuelle;
}

function gueltigesDatum(j: number, m: number, t: number, h = 0, min = 0, s = 0): Date | null {
  if (j < 1990 || j > 2100 || m < 1 || m > 12 || t < 1 || t > 31 || h > 23 || min > 59 || s > 59) return null;
  const d = new Date(j, m - 1, t, h, min, s);
  // 31.02. o. ä. ausschließen
  if (d.getFullYear() !== j || d.getMonth() !== m - 1 || d.getDate() !== t) return null;
  return d;
}

/** EXIF-Datum "2026:11:06 14:23:05" (auch mit "-" statt ":"), oder ein Date-Objekt. */
export function datumAusExif(wert: unknown): Date | null {
  if (wert instanceof Date) return isNaN(wert.getTime()) ? null : wert;
  if (typeof wert !== 'string') return null;
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(wert.trim());
  if (!m) return null;
  return gueltigesDatum(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
}

/** Datum im Dateinamen, z. B. IMG_20261106_142305.jpg, 2026-11-06 Baustelle.jpg, PXL_20261106… */
export function datumAusDateiname(name: string | null | undefined): Date | null {
  if (!name) return null;
  const re = /(?:^|\D)(20\d{2})[-_.]?([01]\d)[-_.]?([0-3]\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(name))) {
    const d = gueltigesDatum(+m[1], +m[2], +m[3]);
    if (d) return d;
  }
  return null;
}

export function fotoZeit(opt: { exifDatum?: unknown; dateiname?: string | null; kameraJetzt?: Date }): FotoZeit {
  const exif = datumAusExif(opt.exifDatum);
  if (exif) return { aufnahme: exif.toISOString(), kw: kwSchluessel(isoKw(exif)), quelle: 'exif' };
  if (opt.kameraJetzt) {
    return { aufnahme: opt.kameraJetzt.toISOString(), kw: kwSchluessel(isoKw(opt.kameraJetzt)), quelle: 'kamera' };
  }
  const ausName = datumAusDateiname(opt.dateiname);
  if (ausName) return { aufnahme: ausName.toISOString(), kw: kwSchluessel(isoKw(ausName)), quelle: 'dateiname' };
  return { aufnahme: null, kw: null, quelle: 'unbekannt' };
}
