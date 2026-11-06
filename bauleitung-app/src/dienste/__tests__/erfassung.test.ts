import { MemoryStore } from '../../data/RecordStore';
import { Repo } from '../../data/repo';
import type { BoardEintrag, Foto, Projekt, Protokoll, ProtokollPunkt, Woche } from '../../domain/types';
import { KiNichtVerfuegbar, type ki as kiTyp } from '../../ki/client';
import { erfasse, ErfassungFehler, rueckgaengig } from '../erfassung';
import { kiNachholen } from '../kiNachholen';

const heute = new Date(2026, 10, 6, 10); // KW 45/2026

async function setup(kiErlaubt = false) {
  const store = new MemoryStore();
  let n = 0;
  const neueId = () => `id${++n}`;
  const repo = new Repo(store, () => 'Diego', neueId);
  const projekt = await repo.neu<Projekt>('projekt', null, { nr: '1', name: 'P', bauherr: '', adresse: '', kiErlaubt });
  return { store, repo, projekt, neueId };
}

const kiAus: typeof kiTyp = {
  erfassung: async () => {
    throw new KiNichtVerfuegbar('offline');
  },
  board: async () => {
    throw new KiNichtVerfuegbar('offline');
  },
  jourfixe: async () => {
    throw new KiNichtVerfuegbar('offline');
  },
};

describe('Schnellerfassung ohne KI (offline)', () => {
  it('"kw40 Estrich 1.OG" landet in KW 40, die Woche wird angelegt', async () => {
    const { repo, projekt, neueId } = await setup();
    const r = await erfasse({ repo, projekt, kiEinst: null, neueId, heute }, { text: 'kw40 Estrich 1.OG' });
    expect(r.ziel).toBe('board');
    expect(r.zusammenfassung).toBe('KW 40 · Bauleitung / Nachunternehmer');
    const [e] = await repo.alle<BoardEintrag>('board', projekt.id);
    expect(e).toMatchObject({ kw: '2026-W40', titel: 'Estrich 1.OG', ki: 'manuell', rohtext: 'Estrich 1.OG' });
    expect((await repo.alle<Woche>('woche', projekt.id)).map((w) => w.kw)).toEqual(['2026-W40']);
  });

  it('ohne kw → aktuelle Woche; vorhandene Woche wird nicht doppelt angelegt', async () => {
    const { repo, projekt, neueId } = await setup();
    const ctx = { repo, projekt, kiEinst: null, neueId, heute };
    await erfasse(ctx, { text: 'Donnerstag Lieferung Trockenbau' });
    const r2 = await erfasse(ctx, { text: 'Bauzaun versetzen' });
    expect(r2.erstellt.map((x) => x.typ)).toEqual(['board']);
    const eintraege = await repo.alle<BoardEintrag>('board', projekt.id);
    expect(eintraege.map((e) => e.kw)).toEqual(['2026-W45', '2026-W45']);
    expect(eintraege.find((e) => e.rubrik === 'Lieferungen')?.wochentag).toBe('Donnerstag');
  });

  it('"jf …" legt einen Entwurf an und übernimmt offene Punkte des letzten Protokolls', async () => {
    const { repo, projekt, neueId } = await setup();
    const ctx = { repo, projekt, kiEinst: null, neueId, heute };
    const r1 = await erfasse(ctx, { text: 'jf Estrich 1.OG nicht fertig' });
    expect(r1.zusammenfassung).toBe('Jour Fixe Nr. 1 (Entwurf) – neu angelegt');
    // Protokoll 1 abschließen, einen Punkt erledigen
    const [p1] = await repo.alle<Protokoll>('protokoll', projekt.id);
    await repo.aendere(p1, { status: 'abgeschlossen' });
    await erfasse(ctx, { text: 'jf Brandschutz Schotts prüfen' }); // geht in Nr. 2 (neu)
    const r3 = await erfasse(ctx, { text: 'jf Fassade Musterachse' }); // geht in Nr. 2 (offen)
    expect(r3.zusammenfassung).toBe('Jour Fixe Nr. 2 (Entwurf)');
    const protokolle = await repo.alle<Protokoll>('protokoll', projekt.id);
    const nr2 = protokolle.find((p) => p.nr === 2)!;
    const punkte = (await repo.alle<ProtokollPunkt>('protokollpunkt', projekt.id))
      .filter((p) => p.protokollId === nr2.id)
      .sort((a, b) => a.reihenfolge - b.reihenfolge);
    expect(punkte.map((p) => [p.thema, p.ursprungNr])).toEqual([
      ['Estrich 1.OG nicht fertig', 1],
      ['Brandschutz Schotts prüfen', 2],
      ['Fassade Musterachse', 2],
    ]);
  });

  it('nur Foto ohne Text → nur Foto mit KW aus dem Bild', async () => {
    const { repo, projekt, neueId } = await setup();
    const bild = { datei: 'a.jpg', breite: 10, hoehe: 10, originalName: null, aufnahme: null, kw: '2026-W44', quelle: 'exif' as const };
    const r = await erfasse({ repo, projekt, kiEinst: null, neueId, heute }, { text: '', bild });
    expect(r.ziel).toBe('foto');
    expect(r.zusammenfassung).toBe('Foto · KW 44');
    expect((r.haupt as Foto).gewerk).toBeNull();
  });

  it('Foto mit Text → Board-Eintrag mit Foto', async () => {
    const { repo, projekt, neueId } = await setup();
    const bild = { datei: 'a.jpg', breite: 10, hoehe: 10, originalName: null, aufnahme: null, kw: null, quelle: 'unbekannt' as const };
    const r = await erfasse({ repo, projekt, kiEinst: null, neueId, heute }, { text: 'Revisionsklappe fehlt', bild });
    const foto = r.erstellt.find((x) => x.typ === 'foto')!;
    expect((r.haupt as BoardEintrag).fotoIds).toEqual([foto.id]);
  });

  it('Fehlermeldungen', async () => {
    const { repo, projekt, neueId } = await setup();
    const ctx = { repo, projekt, kiEinst: null, neueId, heute };
    await expect(erfasse(ctx, { text: 'kw40' })).rejects.toThrow('Bitte zusätzlich einen Inhalt angeben.');
    await expect(erfasse(ctx, { text: 'kw54 Estrich' })).rejects.toThrow(ErfassungFehler);
    await expect(erfasse(ctx, { text: '  ' })).rejects.toThrow('Bitte Text eingeben oder Foto aufnehmen.');
  });

  it('Rückgängig entfernt Eintrag und neu angelegte Woche', async () => {
    const { repo, projekt, neueId } = await setup();
    const r = await erfasse({ repo, projekt, kiEinst: null, neueId, heute }, { text: 'kw40 Estrich' });
    await rueckgaengig(repo, r.erstellt);
    expect(await repo.alle('board', projekt.id)).toHaveLength(0);
    expect(await repo.alle('woche', projekt.id)).toHaveLength(0);
  });
});

describe('Schnellerfassung mit KI', () => {
  const kiAn: typeof kiTyp = {
    erfassung: async () => ({
      ziel: 'board',
      board: {
        bereich: 'bauleitung',
        rubrik: 'Lieferungen',
        titel: 'Lieferung Trockenbau',
        beschreibung: 'Am Donnerstag wird das Trockenbaumaterial angeliefert.',
        checkpunkte: ['Zuwegung prüfen', 'Lagerfläche definieren'],
        wochentag: 'Donnerstag',
      },
      jourfixe: { thema: 'x', beschreibung: 'y' },
    }),
    board: async () => ({
      bereich: 'bauleitung',
      rubrik: 'Nachunternehmer',
      titel: 'Estricharbeiten 1. OG',
      beschreibung: 'Der Estrich im 1. OG wird eingebracht.',
      checkpunkte: ['Vorleistung prüfen', 'Heizestrich Belegreife prüfen'],
      wochentag: null,
    }),
    jourfixe: async () => ({ thema: 'Estrich 1. OG', beschreibung: 'Der Estrich im 1. OG ist noch nicht fertiggestellt.' }),
  };

  it('nutzt die KI-Ausformulierung, wenn erlaubt und erreichbar', async () => {
    const { repo, projekt, neueId } = await setup(true);
    const r = await erfasse({ repo, projekt, kiEinst: { url: 'x', schluessel: 'y' }, ki: kiAn, neueId, heute }, { text: 'Donnerstag Lieferung TB' });
    expect(r.haupt).toMatchObject({ titel: 'Lieferung Trockenbau', rubrik: 'Lieferungen', ki: 'fertig', wochentag: 'Donnerstag' });
    expect(r.hinweis).toBeNull();
  });

  it('KI aus im Projekt → KI wird nie aufgerufen', async () => {
    const { repo, projekt, neueId } = await setup(false);
    let aufgerufen = false;
    const spion = { ...kiAn, erfassung: async (...a: Parameters<typeof kiAn.erfassung>) => ((aufgerufen = true), kiAn.erfassung(...a)) };
    await erfasse({ repo, projekt, kiEinst: { url: 'x', schluessel: 'y' }, ki: spion, neueId, heute }, { text: 'Estrich' });
    expect(aufgerufen).toBe(false);
  });

  it('offline → Stichwortzuordnung, später nachgeholt; eigene Änderungen bleiben', async () => {
    const { repo, projekt, neueId } = await setup(true);
    const ctx = { repo, projekt, kiEinst: { url: 'x', schluessel: 'y' }, ki: kiAus, neueId, heute };
    const r1 = await erfasse(ctx, { text: 'kw40 Estrich 1.OG' });
    expect(r1.haupt).toMatchObject({ ki: 'ausstehend', titel: 'Estrich 1.OG' });
    expect(r1.hinweis).toContain('nachgeholt');
    const r2 = await erfasse(ctx, { text: 'Estrich 2.OG' });
    await repo.aendere(r2.haupt as BoardEintrag, { titel: 'Mein Titel' });
    const r3 = await erfasse(ctx, { text: 'jf Estrich 1.OG' });

    const n = await kiNachholen({ repo, projekte: [projekt], kiEinst: ctx.kiEinst, neueId, ki: kiAn });
    expect(n).toBe(3);
    expect(await repo.hole(r1.haupt.id)).toMatchObject({ titel: 'Estricharbeiten 1. OG', ki: 'fertig', kw: '2026-W40' });
    expect((await repo.hole<BoardEintrag>(r1.haupt.id))!.checkpunkte.map((c) => c.text)).toEqual([
      'Vorleistung prüfen',
      'Heizestrich Belegreife prüfen',
    ]);
    expect(await repo.hole(r2.haupt.id)).toMatchObject({ titel: 'Mein Titel', ki: 'fertig' });
    expect(await repo.hole(r3.haupt.id)).toMatchObject({ thema: 'Estrich 1. OG', ki: 'fertig' });
  });
});
