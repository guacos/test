/** Fotos anlegen, taggen und löschen (ein gemeinsamer Fotobestand für alle Module). */
import type { FotoZeit } from '../domain/fotoKw';
import type { Foto, FotoAblage, Inhalt, Projekt } from '../domain/types';
import type { Repo } from '../data/repo';

export interface BildDaten extends FotoZeit {
  datei: string;
  breite: number;
  hoehe: number;
  originalName: string | null;
}

export async function fotoAnlegen(
  repo: Repo,
  projekt: Pick<Projekt, 'id' | 'kiErlaubt'>,
  bild: BildDaten,
  opt: { ablage?: FotoAblage; notiz?: string; gewerk?: string | null; geschoss?: string | null; tags?: string[] } = {},
): Promise<Foto> {
  const ablage = opt.ablage ?? 'fotos';
  const felder: Inhalt<Foto> = {
    datei: bild.datei,
    breite: bild.breite,
    hoehe: bild.hoehe,
    aufnahme: bild.aufnahme,
    kw: bild.kw,
    kwQuelle: bild.quelle,
    gewerk: opt.gewerk ?? null,
    art: null,
    geschoss: opt.geschoss ?? null,
    tags: opt.tags ?? [],
    notiz: opt.notiz ?? '',
    originalName: bild.originalName,
    ablage,
    oneDrivePfad: null,
    kiVorschlag: false,
    // KI-Tagging nur für die Fotodokumentation und nur, wenn im Projekt erlaubt
    ki: projekt.kiErlaubt && ablage === 'fotos' ? 'ausstehend' : 'manuell',
  };
  return repo.neu<Foto>('foto', projekt.id, felder);
}

/** Tags ändern. Eine manuelle Änderung von Gewerk/Art bestätigt bzw. ersetzt den KI-Vorschlag. */
export async function fotoAendern(repo: Repo, id: string, aenderung: Partial<Inhalt<Foto>>): Promise<Foto | undefined> {
  return repo.aendereAktuell<Foto>(id, (akt) => {
    const manuell = 'gewerk' in aenderung || 'art' in aenderung;
    return {
      ...aenderung,
      ...(manuell ? { kiVorschlag: false, ki: akt.ki === 'ausstehend' ? 'manuell' : akt.ki } : {}),
      ...('kw' in aenderung && aenderung.kw !== akt.kw ? { kwQuelle: aenderung.kw ? 'manuell' : 'unbekannt' } : {}),
    };
  });
}

export async function fotoLoeschen(repo: Repo, id: string): Promise<void> {
  const f = await repo.holeAktiv<Foto>(id);
  if (f) await repo.loesche(f);
}
