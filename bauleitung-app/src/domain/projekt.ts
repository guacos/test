import type { Projekt, ProjektDaten } from './types';

/** Zeichen, die OneDrive in Datei- und Ordnernamen nicht erlaubt. */
const VERBOTEN = /["*:<>?/\\|]/g;

/**
 * Macht aus einem Text einen gültigen OneDrive-Ordnernamen-Teil:
 * verbotene Zeichen → "-", Leerzeichen bleiben, mehrfache Leerzeichen werden eins,
 * keine Punkte oder Leerzeichen am Anfang/Ende.
 */
export function sichererName(text: string): string {
  return text
    .replace(VERBOTEN, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');
}

/** Ordnername des Projekts in OneDrive: {ProjektNr}_{Projektname} */
export function projektOrdnerName(p: Pick<Projekt, 'nr' | 'name'>): string {
  return `${sichererName(p.nr)}_${sichererName(p.name)}`;
}

export interface Pruefergebnis {
  ok: boolean;
  fehler: Partial<Record<keyof ProjektDaten, string>>;
}

/** Prüft die Projekteingaben. Projekt-Nr. und Name sind Pflicht (daraus entsteht der Ordnername). */
export function pruefeProjekt(d: ProjektDaten, andere: Pick<Projekt, 'id' | 'nr'>[] = [], eigeneId?: string): Pruefergebnis {
  const fehler: Pruefergebnis['fehler'] = {};
  if (!sichererName(d.nr)) fehler.nr = 'Bitte Projekt-Nr. eingeben.';
  if (!sichererName(d.name)) fehler.name = 'Bitte Projektname eingeben.';
  const nrNorm = sichererName(d.nr).toLowerCase();
  if (nrNorm && andere.some((p) => p.id !== eigeneId && sichererName(p.nr).toLowerCase() === nrNorm)) {
    fehler.nr = 'Diese Projekt-Nr. gibt es schon.';
  }
  return { ok: Object.keys(fehler).length === 0, fehler };
}

/** Sortierung für die Projektliste: nach Projekt-Nr., natürlich (2 vor 10). */
export function sortiereProjekte<T extends Pick<Projekt, 'nr' | 'name'>>(liste: T[]): T[] {
  return [...liste].sort(
    (a, b) => a.nr.localeCompare(b.nr, 'de', { numeric: true }) || a.name.localeCompare(b.name, 'de'),
  );
}

export const LEERES_PROJEKT: ProjektDaten = { nr: '', name: '', bauherr: '', adresse: '', kiErlaubt: false };
