/** Bautagebuch: je Projekt ein Eintrag pro Tag. */
import type { Bautag, FirmaAnwesenheit, Inhalt } from '../domain/types';
import type { Repo } from '../data/repo';

export const LEERER_TAG = (datum: string): Inhalt<Bautag> => ({ datum, wetter: null, firmen: [], notiz: '', fotoIds: [] });

/** Ändert den Eintrag eines Tages; legt ihn bei der ersten Änderung an. */
export async function tagAendern(
  repo: Repo,
  projektId: string,
  datum: string,
  aenderung: (akt: Inhalt<Bautag>) => Partial<Inhalt<Bautag>>,
): Promise<Bautag> {
  const vorhanden = (await repo.alle<Bautag>('bautag', projektId)).find((t) => t.datum === datum);
  if (vorhanden) return repo.aendere<Bautag>(vorhanden, aenderung(vorhanden));
  const leer = LEERER_TAG(datum);
  return repo.neu<Bautag>('bautag', projektId, { ...leer, ...aenderung(leer) });
}

/** Firmen des letzten Tages davor, die heute noch nicht eingetragen sind (als Vorschlag). */
export function vortagFirmen(alle: Bautag[], datum: string, schonDa: FirmaAnwesenheit[]): FirmaAnwesenheit[] {
  const davor = alle.filter((t) => t.datum < datum && t.firmen.length > 0).sort((a, b) => b.datum.localeCompare(a.datum))[0];
  if (!davor) return [];
  const namen = new Set(schonDa.map((f) => f.name.toLowerCase()));
  return davor.firmen.filter((f) => !namen.has(f.name.toLowerCase()));
}

export function arbeiterGesamt(tag: Pick<Bautag, 'firmen'> | null | undefined): number {
  return (tag?.firmen ?? []).reduce((n, f) => n + f.anzahl, 0);
}
