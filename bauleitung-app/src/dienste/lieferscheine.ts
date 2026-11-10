/** Lieferscheine: Foto → (KI liest Felder) → Kurzprüfung → geplante Lieferung im Board als geliefert markieren. */
import { heuteIso, istIsoDatum } from '../domain/datum';
import type { BoardEintrag, Inhalt, KiStatus, Lieferschein, Projekt } from '../domain/types';
import type { Repo } from '../data/repo';
import { ki as kiStandard, type Ki, type KiEinstellungen } from '../ki/client';
import { fotoAnlegen, type BildDaten } from './fotos';

export async function lieferscheinAusBild(opt: {
  repo: Repo;
  projekt: Pick<Projekt, 'id' | 'kiErlaubt'>;
  bild: BildDaten;
  kiEinst: KiEinstellungen | null;
  bildFuerKi: (datei: string) => Promise<string>;
  ki?: Ki;
}): Promise<{ schein: Lieferschein; hinweis: string | null }> {
  const foto = await fotoAnlegen(opt.repo, opt.projekt, opt.bild, { ablage: 'lieferschein' });
  const felder: Inhalt<Lieferschein> = {
    fotoId: foto.id,
    lieferant: '',
    datum: opt.bild.aufnahme ? opt.bild.aufnahme.slice(0, 10) : heuteIso(),
    nummer: '',
    material: '',
    menge: '',
    firmaId: null,
    firmaName: '',
    mengeOk: null,
    schaeden: '',
    lagerort: '',
    boardEintragId: null,
    ki: 'manuell',
  };
  let status: KiStatus = opt.projekt.kiErlaubt ? 'ausstehend' : 'manuell';
  let hinweis: string | null = null;
  if (opt.projekt.kiErlaubt) {
    try {
      const r = await (opt.ki ?? kiStandard).lieferschein(opt.kiEinst, await opt.bildFuerKi(opt.bild.datei));
      felder.lieferant = r.lieferant;
      if (istIsoDatum(r.datum)) felder.datum = r.datum;
      felder.nummer = r.nummer;
      felder.material = r.material;
      felder.menge = r.menge;
      status = 'fertig';
      hinweis = 'Die KI hat den Lieferschein gelesen – bitte die Angaben prüfen.';
    } catch {
      hinweis = 'KI nicht erreichbar – bitte die Angaben von Hand eintragen. Das Auslesen wird nachgeholt.';
    }
  }
  const schein = await opt.repo.neu<Lieferschein>('lieferschein', opt.projekt.id, { ...felder, ki: status });
  return { schein, hinweis };
}

/** Verknüpft den Lieferschein mit einer geplanten Lieferung und markiert sie als geliefert (null = lösen). */
export async function verknuepfeLieferung(repo: Repo, scheinId: string, boardEintragId: string | null): Promise<void> {
  const schein = await repo.holeAktiv<Lieferschein>(scheinId);
  if (!schein) return;
  if (schein.boardEintragId && schein.boardEintragId !== boardEintragId) {
    await repo.aendereAktuell<BoardEintrag>(schein.boardEintragId, () => ({ geliefert: false }));
  }
  if (boardEintragId) await repo.aendereAktuell<BoardEintrag>(boardEintragId, () => ({ geliefert: true }));
  await repo.aendere<Lieferschein>(schein, { boardEintragId });
}

/** Geplante Lieferungen aus dem Board, die zu diesem Lieferschein passen könnten (noch nicht geliefert oder schon verknüpft). */
export function offeneLieferungen(board: BoardEintrag[], schein: Pick<Lieferschein, 'boardEintragId'>): BoardEintrag[] {
  return board
    .filter((e) => e.rubrik === 'Lieferungen' && (!e.geliefert || e.id === schein.boardEintragId))
    .sort((a, b) => b.kw.localeCompare(a.kw));
}
