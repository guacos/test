/**
 * Prüft den OneDrive-Zugriff über HTTP gegen einen simulierten Graph-Server
 * und lässt den kompletten Abgleich darüber laufen.
 */
import { MemoryStore } from '../../data/RecordStore';
import { Repo } from '../../data/repo';
import type { BoardEintrag, Inhalt, Projekt } from '../../domain/types';
import { abgleichen, ladeKonflikte, projektBeitreten } from '../../sync/engine';
import { TestDateien } from '../../sync/testLaufwerk';
import { Graph, GraphFehler, NichtAngemeldet } from '../graph';
import { freigabeKennung, GraphLaufwerk, KeinSchreibrecht, LaufwerkKonflikt } from '../laufwerk';
import { erstelleTermin, parseEmpfaenger, sendeMail, terminZeiten, zuBase64 } from '../outlook';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { erstelleFakeGraph } = require('../../../e2e/fakeGraph.js');

// Die Testumgebung ersetzt fetch durch eine Attrappe – hier wird echtes HTTP über Node benutzt.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require('node:http');
const httpFetch = ((url: string, init: { method?: string; headers?: Record<string, string>; body?: string | Uint8Array } = {}) =>
  new Promise((ok, fehler) => {
    const req = http.request(url, { method: init.method ?? 'GET', headers: init.headers }, (res: { statusCode: number; headers: Record<string, string>; on: (e: string, f: (d?: Buffer) => void) => void }) => {
      const teile: Buffer[] = [];
      res.on('data', (d) => teile.push(d!));
      res.on('end', () => {
        const daten = Buffer.concat(teile);
        ok({
          status: res.statusCode,
          ok: res.statusCode >= 200 && res.statusCode < 300,
          headers: { get: (n: string) => res.headers[n.toLowerCase()] ?? null },
          json: async () => JSON.parse(daten.toString()),
          arrayBuffer: async () => daten.buffer.slice(daten.byteOffset, daten.byteOffset + daten.byteLength),
        });
      });
    });
    req.on('error', fehler);
    if (init.body) req.write(typeof init.body === 'string' ? init.body : Buffer.from(init.body));
    req.end();
  })) as unknown as typeof fetch;

type Fake = ReturnType<typeof erstelleFakeGraph>;
let fake: Fake;
let basis: string;

beforeEach(async () => {
  fake = erstelleFakeGraph({ seitenGroesse: 3 });
  basis = `http://127.0.0.1:${await fake.starte()}/v1.0`;
});
afterEach(() => fake.stoppe());

const graphFuer = (konto: string | null) => new Graph(async () => (konto ? `test-${konto}` : null), basis, httpFetch);
const lwFuer = (konto: string) => new GraphLaufwerk(graphFuer(konto));
const txt = (b: Uint8Array | null) => (b ? new TextDecoder().decode(b) : null);

describe('OneDrive über Microsoft Graph (simulierter Server)', () => {
  it('Ordner anlegen, schreiben, lesen, auflisten (mit Folgeseiten)', async () => {
    const lw = lwFuer('diego');
    const w = lw.wurzel();
    const ordner = await lw.ordner(w, 'Bauleitung-App/Projekt Ä/_daten');
    expect(ordner).toMatchObject({ name: '_daten', istOrdner: true });
    expect((await lw.ordner(w, 'Bauleitung-App/Projekt Ä/_daten')).id).toBe(ordner.id);
    for (let i = 0; i < 8; i++) await lw.schreibe(w, `Bauleitung-App/Projekt Ä/_daten/d${i}.json`, `{"n":${i}}`);
    const liste = await lw.liste(w, 'Bauleitung-App/Projekt Ä/_daten');
    expect(liste!.map((e) => e.name).sort()).toEqual(['d0.json', 'd1.json', 'd2.json', 'd3.json', 'd4.json', 'd5.json', 'd6.json', 'd7.json']);
    expect(txt(await lw.lies(w, 'Bauleitung-App/Projekt Ä/_daten/d3.json'))).toBe('{"n":3}');
    expect(await lw.lies(w, 'Bauleitung-App/gibtsnicht.json')).toBeNull();
    expect(await lw.liste(w, 'Bauleitung-App/gibtsnicht')).toBeNull();
    expect(await lw.hole(w, 'Bauleitung-App/gibtsnicht')).toBeNull();
    // Zugriff relativ zu einem Ordner
    const ref = { driveId: null, itemId: ordner.id };
    expect(txt(await lw.lies(ref, 'd1.json'))).toBe('{"n":1}');
  });

  it('nur neu anlegen / nur überschreiben, wenn unverändert', async () => {
    const lw = lwFuer('diego');
    const w = lw.wurzel();
    const e1 = await lw.schreibe(w, 'a/x.json', 'eins', { nurNeu: true });
    await expect(lw.schreibe(w, 'a/x.json', 'zwei', { nurNeu: true })).rejects.toBeInstanceOf(LaufwerkKonflikt);
    const e2 = await lw.schreibe(w, 'a/x.json', 'zwei', { ifMatch: e1.eTag });
    expect(e2.eTag).not.toBe(e1.eTag);
    await expect(lw.schreibe(w, 'a/x.json', 'drei', { ifMatch: e1.eTag })).rejects.toBeInstanceOf(LaufwerkKonflikt);
    expect(txt(await lw.lies(w, 'a/x.json'))).toBe('zwei');
  });

  it('verschieben, umbenennen, löschen', async () => {
    const lw = lwFuer('diego');
    const w = lw.wurzel();
    await lw.schreibe(w, 'p/02_Fotos/2026_KW45/a_001.jpg', new Uint8Array([1, 2]));
    await lw.verschiebe(w, 'p/02_Fotos/2026_KW45/a_001.jpg', 'p/02_Fotos/2026_KW44/b_001.jpg');
    expect(fake.pfade('diego')).toEqual(['p/02_Fotos/2026_KW44/b_001.jpg']);
    await lw.loesche(w, 'p/02_Fotos/2026_KW44/b_001.jpg');
    await lw.loesche(w, 'p/02_Fotos/2026_KW44/b_001.jpg'); // schon weg: kein Fehler
    expect(fake.pfade('diego')).toEqual([]);
  });

  it('Freigabe-Link, Schreibschutz, fehlende Anmeldung', async () => {
    const diego = lwFuer('diego');
    await diego.schreibe(diego.wurzel(), 'Bauleitung-App/P/_daten/projekt.json', '{}');
    const link = fake.teile('diego', 'Bauleitung-App/P', true);
    const gast = lwFuer('gast');
    const { ref, name } = await gast.ausFreigabeLink(link);
    expect(name).toBe('P');
    expect(txt(await gast.lies(ref, '_daten/projekt.json'))).toBe('{}');
    await expect(gast.schreibe(ref, '_daten/x.json', '1')).rejects.toBeInstanceOf(KeinSchreibrecht);
    await expect(gast.ausFreigabeLink('https://1drv.ms/f/unbekannt')).rejects.toBeInstanceOf(GraphFehler);
    expect(freigabeKennung('https://1drv.ms/f/s!ID5')).toMatch(/^u![A-Za-z0-9_-]+$/);
    await expect(lwFuer('x').hole({ driveId: 'diego', itemId: 'ID1' }, '')).rejects.toBeInstanceOf(GraphFehler); // fremdes Laufwerk ohne Freigabe
    await expect(new GraphLaufwerk(graphFuer(null)).hole(diego.wurzel(), '')).rejects.toBeInstanceOf(NichtAngemeldet);
  });

  it('wiederholt bei vorübergehender Störung (503)', async () => {
    const lw = lwFuer('diego');
    await httpFetch(`${basis.replace('/v1.0', '')}/__stoerung?anzahl=2`);
    expect(await lw.ordner(lw.wurzel(), 'x')).toMatchObject({ name: 'x' });
  });

  it('kompletter Abgleich über HTTP: zwei Geräte, Konflikt, geteiltes Projekt', async () => {
    let n = 0;
    const geraet = (konto: string, name: string) => {
      const store = new MemoryStore();
      const repo = new Repo(store, () => name, () => `${name}-${++n}`);
      return { lw: lwFuer(konto), repo, dateien: new TestDateien(), store };
    };
    const eintrag = (titel: string): Inhalt<BoardEintrag> => ({
      kw: '2026-W40', bereich: 'bauleitung', rubrik: 'Nachunternehmer', titel, text: titel, wochentag: null, checkpunkte: [],
      pruefkette: { vorleistung: false, material: false, planstand: false, qualitaet: false }, fotoIds: [], notiz: '', rohtext: titel, ki: 'manuell',
    });
    const handy = geraet('diego', 'Handy');
    const mac = geraet('diego', 'Mac');
    const p = await handy.repo.neu<Projekt>('projekt', null, { nr: '2026-014', name: 'Halle Nord', bauherr: '', adresse: '', kiErlaubt: false });
    const e = await handy.repo.neu<BoardEintrag>('board', p.id, eintrag('Estrich 1.OG'));
    expect((await abgleichen(handy)).fehler).toEqual([]);
    const P = 'Bauleitung-App/2026-014_Halle Nord';
    expect(fake.pfade('diego')).toEqual([`${P}/_daten/board/${e.id}.json`, `${P}/_daten/projekt.json`]);
    expect(JSON.parse(fake.text('diego', `${P}/_daten/board/${e.id}.json`))).toMatchObject({ titel: 'Estrich 1.OG', erstelltVon: 'Handy' });

    await abgleichen(mac);
    expect((await mac.repo.hole<BoardEintrag>(e.id))!.titel).toBe('Estrich 1.OG');

    await handy.repo.aendere((await handy.repo.hole<BoardEintrag>(e.id))!, { titel: 'Handy' });
    await mac.repo.aendere((await mac.repo.hole<BoardEintrag>(e.id))!, { titel: 'Mac' });
    await abgleichen(mac);
    expect((await abgleichen(handy)).konflikte).toBe(1);
    expect(await ladeKonflikte(handy.store)).toHaveLength(1);
    expect(JSON.parse(fake.text('diego', `${P}/_daten/board/${e.id}.json`)).titel).toBe('Mac');

    const kollege = geraet('kollege', 'Kollege');
    await projektBeitreten(kollege, fake.teile('diego', P, false));
    await abgleichen(kollege);
    await kollege.repo.neu<BoardEintrag>('board', p.id, eintrag('Vom Kollegen'));
    expect((await abgleichen(kollege)).hoch).toBe(1);
    await abgleichen(mac);
    expect((await mac.repo.alle<BoardEintrag>('board', p.id)).map((x) => x.titel).sort()).toEqual(['Mac', 'Vom Kollegen']);
    expect(fake.pfade('kollege')).toEqual([]);
  });
});

describe('Outlook über Microsoft Graph (simulierter Server)', () => {
  it('sendet eine E-Mail mit PDF-Anhang', async () => {
    const pdf = new TextEncoder().encode('%PDF-1.7 test');
    await sendeMail(graphFuer('diego'), { an: ['becker@example.com'], betreff: 'Protokoll', text: 'Anbei', anhang: { name: 'JF_001.pdf', bytes: pdf, typ: 'application/pdf' } });
    expect(fake.zustand.mails).toEqual([
      { von: 'diego', an: ['becker@example.com'], betreff: 'Protokoll', text: 'Anbei', anhaenge: [{ name: 'JF_001.pdf', typ: 'application/pdf', bytes: pdf.length, kopf: '%PDF-' }] },
    ]);
    await expect(sendeMail(graphFuer('diego'), { an: [], betreff: 'x', text: 'y' })).rejects.toBeInstanceOf(GraphFehler);
    await expect(sendeMail(graphFuer('diego'), { an: ['a@b.de'], betreff: 'x', text: 'y', anhang: { name: 'g.pdf', bytes: new Uint8Array(3_100_000), typ: 'application/pdf' } })).rejects.toThrow('zu groß');
  });

  it('trägt einen Termin ein', async () => {
    await erstelleTermin(graphFuer('diego'), { betreff: 'Jour Fixe Nr. 4', datum: '2026-11-13', beginn: '09:00', dauerMinuten: 90, ort: 'Baubüro', text: '', teilnehmer: ['becker@example.com'] });
    expect(fake.zustand.termine[0]).toMatchObject({
      betreff: 'Jour Fixe Nr. 4',
      start: { dateTime: '2026-11-13T09:00:00', timeZone: 'Europe/Berlin' },
      ende: { dateTime: '2026-11-13T10:30:00', timeZone: 'Europe/Berlin' },
      ort: 'Baubüro',
      teilnehmer: ['becker@example.com'],
    });
  });

  it('Hilfsfunktionen', () => {
    expect(parseEmpfaenger('A@b.de, c@d.de; unsinn  a@b.de')).toEqual({ gueltig: ['a@b.de', 'c@d.de'], ungueltig: ['unsinn'] });
    expect(terminZeiten('2026-12-31', '23:30', 60)).toEqual({ start: '2026-12-31T23:30:00', ende: '2027-01-01T00:30:00' });
    expect(zuBase64(new Uint8Array([72, 105]))).toBe('SGk=');
  });
});
