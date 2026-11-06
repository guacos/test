/**
 * Jour Fixe: neues Protokoll anlegen und offene Punkte aus dem letzten Protokoll übernehmen.
 */
import type { Protokoll, ProtokollPunkt } from './types';

type Inhalt<T> = Omit<T, keyof import('./types').BaseRecord>;

/** Nächste fortlaufende Protokoll-Nr. */
export function naechsteProtokollNr(protokolle: Pick<Protokoll, 'nr'>[]): number {
  return protokolle.reduce((max, p) => Math.max(max, p.nr), 0) + 1;
}

/** Letztes Protokoll = höchste Nr. */
export function letztesProtokoll<T extends Pick<Protokoll, 'nr'>>(protokolle: T[]): T | undefined {
  return protokolle.reduce<T | undefined>((best, p) => (!best || p.nr > best.nr ? p : best), undefined);
}

/** Protokoll, in das "jf …" geht: das neueste, wenn es noch ein Entwurf ist. */
export function offenerEntwurf<T extends Pick<Protokoll, 'nr' | 'status'>>(protokolle: T[]): T | undefined {
  const letztes = letztesProtokoll(protokolle);
  return letztes?.status === 'entwurf' ? letztes : undefined;
}

/**
 * Kopien aller offenen Punkte des Vorprotokolls für ein neues Protokoll.
 * threadId und ursprungNr bleiben erhalten (für "offen seit Nr. X" und die Farbe Schwarz).
 * Erledigte Punkte bleiben nur im alten Protokoll.
 */
export function uebernehmePunkte(
  vorherigePunkte: ProtokollPunkt[],
  neuesProtokollId: string,
): Inhalt<ProtokollPunkt>[] {
  return [...vorherigePunkte]
    .filter((p) => !p.geloescht && p.status === 'offen')
    .sort((a, b) => a.reihenfolge - b.reihenfolge)
    .map((p, i) => ({
      protokollId: neuesProtokollId,
      threadId: p.threadId,
      ursprungNr: p.ursprungNr,
      thema: p.thema,
      beschreibung: p.beschreibung,
      verantwortlich: p.verantwortlich,
      frist: p.frist,
      status: 'offen',
      fotoIds: [...p.fotoIds],
      planausschnittIds: [...p.planausschnittIds],
      ergaenzungen: p.ergaenzungen.map((e) => ({ ...e })),
      reihenfolge: i + 1,
      rohtext: p.rohtext,
      ki: p.ki,
    }));
}
