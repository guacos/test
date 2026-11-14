/**
 * Jour Fixe – Farblogik:
 *  Rot        = Frist überschritten und noch offen (hat Vorrang, steht oben)
 *  Dunkelblau = neu in diesem Protokoll (auch neue Ergänzungen)
 *  Schwarz    = aus einem Vorprotokoll übernommen ("offen seit Nr. X")
 */
import type { Ergaenzung, Protokoll, ProtokollPunkt } from './types';

export type PunktFarbe = 'rot' | 'blau' | 'schwarz';

type PunktKern = Pick<ProtokollPunkt, 'status' | 'frist' | 'ursprungNr'>;

/**
 * Stichtag für "überfällig":
 *  - aktuelles (neuestes) Protokoll in der App: heute
 *  - ältere Protokolle und jedes PDF: das Protokolldatum (ein altes PDF ändert sich nicht nachträglich)
 */
export function stichtag(
  protokoll: Pick<Protokoll, 'datum'>,
  opt: { istAktuell: boolean; fuerPdf: boolean; heute: string },
): string {
  return opt.istAktuell && !opt.fuerPdf ? opt.heute : protokoll.datum;
}

export function istUeberfaellig(p: Pick<ProtokollPunkt, 'status' | 'frist'>, stichtagIso: string): boolean {
  return p.status === 'offen' && !!p.frist && p.frist < stichtagIso;
}

export function istNeu(p: Pick<ProtokollPunkt, 'ursprungNr'>, protokollNr: number): boolean {
  return p.ursprungNr === protokollNr;
}

export function punktFarbe(p: PunktKern, protokollNr: number, stichtagIso: string): PunktFarbe {
  if (istUeberfaellig(p, stichtagIso)) return 'rot';
  return istNeu(p, protokollNr) ? 'blau' : 'schwarz';
}

/** Ergänzungen: neu in diesem Protokoll = dunkelblau, sonst schwarz. */
export function ergaenzungFarbe(e: Pick<Ergaenzung, 'protokollNr'>, protokollNr: number): 'blau' | 'schwarz' {
  return e.protokollNr === protokollNr ? 'blau' : 'schwarz';
}

/** Hinweistext unter dem Punkt. */
export function punktHinweis(p: PunktKern, protokollNr: number, stichtagIso: string): string {
  const teile: string[] = [];
  if (istUeberfaellig(p, stichtagIso)) teile.push('Überfällig');
  teile.push(istNeu(p, protokollNr) ? 'Neu in diesem Protokoll' : `Offen seit Nr. ${p.ursprungNr}`);
  return teile.join(' · ');
}

/** Feste Punkt-Nr.: Ursprungsprotokoll.laufende Nr., z. B. "3.02" */
export function punktNr(p: Pick<ProtokollPunkt, 'ursprungNr' | 'lfdNr'>): string {
  return `${p.ursprungNr}.${String(p.lfdNr ?? 0).padStart(2, '0')}`;
}

/** Sortierung: überfällige Punkte oben, sonst in der gespeicherten Reihenfolge. */
export function sortierePunkte<T extends Pick<ProtokollPunkt, 'status' | 'frist' | 'reihenfolge'>>(
  punkte: T[],
  stichtagIso: string,
): T[] {
  return [...punkte].sort((a, b) => {
    const ua = istUeberfaellig(a, stichtagIso) ? 0 : 1;
    const ub = istUeberfaellig(b, stichtagIso) ? 0 : 1;
    return ua - ub || a.reihenfolge - b.reihenfolge;
  });
}

/** Zähler für die Protokoll-Liste. */
export function zaehlePunkte(punkte: Pick<ProtokollPunkt, 'status' | 'frist'>[], stichtagIso: string) {
  const offen = punkte.filter((p) => p.status === 'offen').length;
  const ueberfaellig = punkte.filter((p) => istUeberfaellig(p, stichtagIso)).length;
  return { gesamt: punkte.length, offen, ueberfaellig };
}

/** Dateiname des Protokoll-PDFs: JF_001_2026-11-06.pdf */
export function protokollDateiname(p: Pick<Protokoll, 'nr' | 'datum'>): string {
  return `JF_${String(p.nr).padStart(3, '0')}_${p.datum}.pdf`;
}
