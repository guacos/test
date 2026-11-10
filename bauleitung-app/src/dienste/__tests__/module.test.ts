import { MemoryStore } from '../../data/RecordStore';
import { Repo } from '../../data/repo';
import type { Bautag, BoardEintrag, Lieferschein, Projekt, Protokoll, ProtokollPunkt } from '../../domain/types';
import { punktNr } from '../../domain/farblogik';
import { KiNichtVerfuegbar, type Ki } from '../../ki/client';
import { tagAendern, vortagFirmen } from '../bautagebuch';
import { erfasse } from '../erfassung';
import { ergaenzungAnhaengen, neuesProtokoll, punktAusKurztext, punkteVon } from '../jourfixe';
import { lieferscheinAusBild, offeneLieferungen, verknuepfeLieferung } from '../lieferscheine';

async function setup(kiErlaubt = false) {
  const store = new MemoryStore();
  let n = 0;
  const neueId = () => `id${++n}`;
  const repo = new Repo(store, () => 'Diego', neueId);
  const projekt = await repo.neu<Projekt>('projekt', null, { nr: '1', name: 'P', bauherr: '', adresse: '', kiErlaubt });
  return { repo, projekt, neueId };
}

const offline = async () => {
  throw new KiNichtVerfuegbar('offline');
};
const kiAus: Ki = { erfassung: offline, board: offline, jourfixe: offline, foto: offline, lieferschein: offline };

describe('Jour Fixe: Protokolle', () => {
  it('neues Protokoll übernimmt offene Punkte, schließt den alten Entwurf und behält die Punkt-Nr.', async () => {
    const { repo, projekt, neueId } = await setup();
    const p1 = (await neuesProtokoll(repo, projekt.id, new Date(2026, 9, 30))).protokoll;
    const a = (await punktAusKurztext({ repo, projekt, protokoll: p1, text: 'estrich 1.OG', kiEinst: null, neueId })).punkt;
    const b = (await punktAusKurztext({ repo, projekt, protokoll: p1, text: 'Bauzaun', kiEinst: null, neueId })).punkt;
    expect([punktNr(a), punktNr(b)]).toEqual(['1.01', '1.02']);
    expect(a).toMatchObject({ thema: 'Estrich 1.OG', beschreibung: 'estrich 1.OG', ki: 'manuell' });
    await repo.aendere(b, { status: 'erledigt' });
    await repo.aendere(p1, { teilnehmer: 'Lento, Becker' });

    const r = await neuesProtokoll(repo, projekt.id, new Date(2026, 10, 6));
    expect(r).toMatchObject({ uebernommen: 1 });
    expect(r.protokoll).toMatchObject({ nr: 2, datum: '2026-11-06', status: 'entwurf', teilnehmer: 'Lento, Becker' });
    expect((await repo.hole<Protokoll>(p1.id))!.status).toBe('abgeschlossen');
    const punkte = await punkteVon(repo, r.protokoll);
    expect(punkte.map((p) => [punktNr(p), p.thema, p.ursprungNr])).toEqual([['1.01', 'Estrich 1.OG', 1]]);
    // das alte Protokoll bleibt unverändert (eigene Kopien)
    expect(await punkteVon(repo, p1)).toHaveLength(2);

    const c = (await punktAusKurztext({ repo, projekt, protokoll: r.protokoll, text: 'Fassade', kiEinst: null, neueId })).punkt;
    expect(punktNr(c)).toBe('2.01');
  });

  it('Ergänzungen werden mit Datum angehängt, der alte Text bleibt', async () => {
    const { repo, projekt, neueId } = await setup();
    const p1 = (await neuesProtokoll(repo, projekt.id)).protokoll;
    const a = (await punktAusKurztext({ repo, projekt, protokoll: p1, text: 'Brandschutz', kiEinst: null, neueId })).punkt;
    const p2 = (await neuesProtokoll(repo, projekt.id)).protokoll;
    const [uebernommen] = await punkteVon(repo, p2);
    await ergaenzungAnhaengen(repo, uebernommen.id, p2.nr, ' Nachweis fehlt ', neueId, new Date(2026, 10, 6));
    const neu = (await repo.hole<ProtokollPunkt>(uebernommen.id))!;
    expect(neu.beschreibung).toBe('Brandschutz');
    expect(neu.ergaenzungen).toEqual([{ id: expect.any(String), datum: '2026-11-06', text: 'Nachweis fehlt', protokollNr: 2 }]);
    expect((await repo.hole<ProtokollPunkt>(a.id))!.ergaenzungen).toEqual([]);
  });

  it('"jf …" aus der Schnellerfassung bekommt eine Punkt-Nr.', async () => {
    const { repo, projekt, neueId } = await setup();
    const r = await erfasse({ repo, projekt, kiEinst: null, neueId, heute: new Date(2026, 10, 6) }, { text: 'jf Estrich' });
    expect(punktNr(r.haupt as ProtokollPunkt)).toBe('1.01');
  });
});

describe('Bautagebuch', () => {
  it('legt je Tag genau einen Eintrag an und schlägt die Firmen des letzten Eintrags vor', async () => {
    const { repo, projekt } = await setup();
    await tagAendern(repo, projekt.id, '2026-11-09', () => ({ firmen: [{ firmaId: null, name: 'Trockenbau Yilmaz', anzahl: 6 }, { firmaId: null, name: 'Elektro Schmitz', anzahl: 3 }] }));
    await tagAendern(repo, projekt.id, '2026-11-09', () => ({ notiz: 'Estrich eingebracht' }));
    const alle = await repo.alle<Bautag>('bautag', projekt.id);
    expect(alle).toHaveLength(1);
    expect(alle[0]).toMatchObject({ notiz: 'Estrich eingebracht', firmen: [{ anzahl: 6 }, { anzahl: 3 }] });
    expect(vortagFirmen(alle, '2026-11-10', [{ firmaId: null, name: 'elektro schmitz', anzahl: 1 }]).map((f) => f.name)).toEqual(['Trockenbau Yilmaz']);
    expect(vortagFirmen(alle, '2026-11-09', [])).toEqual([]);
  });
});

describe('Lieferscheine', () => {
  const bild = { datei: 'ls.jpg', breite: 10, hoehe: 10, originalName: null, aufnahme: new Date(2026, 10, 5, 9).toISOString(), kw: '2026-W45', quelle: 'exif' as const };

  it('KI aus: Felder bleiben leer, Foto landet in der Lieferschein-Ablage', async () => {
    const { repo, projekt } = await setup(false);
    const { schein, hinweis } = await lieferscheinAusBild({ repo, projekt, bild, kiEinst: null, bildFuerKi: async () => 'x', ki: kiAus });
    expect(schein).toMatchObject({ lieferant: '', datum: '2026-11-05', ki: 'manuell' });
    expect(hinweis).toBeNull();
    expect((await repo.hole(schein.fotoId!))).toMatchObject({ ablage: 'lieferschein', ki: 'manuell' });
  });

  it('KI an: liest Lieferant, Datum, Nummer, Material, Menge', async () => {
    const { repo, projekt } = await setup(true);
    const ki: Ki = { ...kiAus, lieferschein: async () => ({ lieferant: 'Baustoff Nord', datum: '2026-11-04', nummer: 'LS-4711', material: 'GK-Platten 12,5 mm', menge: '120 Stück' }) };
    const { schein } = await lieferscheinAusBild({ repo, projekt, bild, kiEinst: { url: 'x', schluessel: 'y' }, bildFuerKi: async () => 'x', ki });
    expect(schein).toMatchObject({ lieferant: 'Baustoff Nord', datum: '2026-11-04', nummer: 'LS-4711', menge: '120 Stück', ki: 'fertig' });
  });

  it('Verknüpfen markiert die geplante Lieferung im Board als geliefert; Lösen nimmt es zurück', async () => {
    const { repo, projekt, neueId } = await setup(false);
    const ctx = { repo, projekt, kiEinst: null, neueId, heute: new Date(2026, 10, 6) };
    const l1 = (await erfasse(ctx, { text: 'Donnerstag Lieferung Trockenbau' })).haupt as BoardEintrag;
    const l2 = (await erfasse(ctx, { text: 'Lieferung Estrich' })).haupt as BoardEintrag;
    const { schein } = await lieferscheinAusBild({ repo, projekt, bild, kiEinst: null, bildFuerKi: async () => 'x', ki: kiAus });
    const board = () => repo.alle<BoardEintrag>('board', projekt.id);
    expect(offeneLieferungen(await board(), schein).map((e) => e.id).sort()).toEqual([l1.id, l2.id].sort());

    await verknuepfeLieferung(repo, schein.id, l1.id);
    expect((await repo.hole<BoardEintrag>(l1.id))!.geliefert).toBe(true);
    await verknuepfeLieferung(repo, schein.id, l2.id);
    expect((await repo.hole<BoardEintrag>(l1.id))!.geliefert).toBe(false);
    expect((await repo.hole<BoardEintrag>(l2.id))!.geliefert).toBe(true);
    await verknuepfeLieferung(repo, schein.id, null);
    expect((await repo.hole<BoardEintrag>(l2.id))!.geliefert).toBe(false);
    expect((await repo.hole<Lieferschein>(schein.id))!.boardEintragId).toBeNull();
  });
});
