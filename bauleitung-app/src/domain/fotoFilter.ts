/** Fotodokumentation: Filtern, Gruppieren und Suchen. */
import { kwTextAusSchluessel } from './kw';
import type { Foto } from './types';

export interface FotoFilter {
  gewerk: string | null;
  art: string | null;
  /** KW-Schlüssel, 'unbekannt' oder null (= alle) */
  kw: string | null;
  geschoss: string | null;
  suche: string;
}

export const LEERER_FILTER: FotoFilter = { gewerk: null, art: null, kw: null, geschoss: null, suche: '' };

/** 'ohne' steht für "noch nicht vergeben". */
export const OHNE = 'ohne';

function passt(wert: string | null, filter: string | null): boolean {
  if (filter === null) return true;
  if (filter === OHNE) return !wert;
  return wert === filter;
}

/** Vereinheitlicht Text für die Suche: klein, ohne Akzente, ß → ss. */
export function normal(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Alle Suchwörter müssen irgendwo im Text vorkommen. */
export function textPasst(text: string, suche: string): boolean {
  const n = normal(text);
  return normal(suche)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => n.includes(w));
}

export function fotoSuchtext(f: Foto): string {
  return [f.gewerk, f.art, f.geschoss, kwTextAusSchluessel(f.kw), ...f.tags, f.notiz, f.originalName].filter(Boolean).join(' ');
}

/** Nur Fotos der Fotodokumentation (keine Planausschnitte, Lieferscheine, Grundrisse). */
export function istDoku(f: Pick<Foto, 'ablage'>): boolean {
  return !f.ablage || f.ablage === 'fotos';
}

export function filtereFotos(fotos: Foto[], filter: FotoFilter): Foto[] {
  return fotos.filter(
    (f) =>
      istDoku(f) &&
      passt(f.gewerk, filter.gewerk) &&
      passt(f.art, filter.art) &&
      passt(f.geschoss, filter.geschoss) &&
      (filter.kw === null || (filter.kw === 'unbekannt' ? !f.kw : f.kw === filter.kw)) &&
      (!filter.suche.trim() || textPasst(fotoSuchtext(f), filter.suche)),
  );
}

export interface FotoGruppe {
  kw: string | null;
  gewerke: { gewerk: string | null; fotos: Foto[] }[];
  anzahl: number;
}

/** Gruppierung KW (neueste zuerst, Unbekannt am Ende) → Gewerk (alphabetisch, ohne Gewerk am Ende). */
export function gruppiereFotos(fotos: Foto[]): FotoGruppe[] {
  const nachKw = new Map<string, Foto[]>();
  for (const f of fotos) {
    const k = f.kw ?? '';
    nachKw.set(k, [...(nachKw.get(k) ?? []), f]);
  }
  const kws = [...nachKw.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : b.localeCompare(a)));
  return kws.map((k) => {
    const liste = nachKw.get(k)!;
    const nachGewerk = new Map<string, Foto[]>();
    for (const f of liste) {
      const g = f.gewerk ?? '';
      nachGewerk.set(g, [...(nachGewerk.get(g) ?? []), f]);
    }
    const gewerke = [...nachGewerk.keys()]
      .sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'de')))
      .map((g) => ({
        gewerk: g || null,
        fotos: nachGewerk.get(g)!.sort((a, b) => (b.aufnahme ?? b.erstelltAm).localeCompare(a.aufnahme ?? a.erstelltAm)),
      }));
    return { kw: k || null, gewerke, anzahl: liste.length };
  });
}

/** Vorhandene Werte für die Filterauswahl. */
export function filterWerte(fotos: Foto[]) {
  const doku = fotos.filter(istDoku);
  const menge = (werte: (string | null)[]) => [...new Set(werte.filter((w): w is string => !!w))];
  return {
    kws: menge(doku.map((f) => f.kw)).sort().reverse(),
    gewerke: menge(doku.map((f) => f.gewerk)).sort((a, b) => a.localeCompare(b, 'de')),
    geschosse: menge(doku.map((f) => f.geschoss)).sort((a, b) => a.localeCompare(b, 'de')),
    hatUnbekannteKw: doku.some((f) => !f.kw),
    hatOhneGewerk: doku.some((f) => !f.gewerk),
  };
}
