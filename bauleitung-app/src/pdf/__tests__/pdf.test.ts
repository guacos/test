import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument } from 'pdf-lib';
import type { Bautag, Mangel, Protokoll, ProtokollPunkt } from '../../domain/types';
import { bautagebuchPdf } from '../bautagebuch';
import { maengelPdf } from '../maengel';
import { protokollPdf } from '../protokoll';

const basis = { projektId: 'p', erstelltVon: 'a', erstelltAm: '', geaendertVon: 'a', geaendertAm: '', version: 1, geloescht: false };
const projekt = { nr: '2026-014', name: 'Neubau Halle Nord', bauherr: 'Muster Logistik GmbH', adresse: 'Industriestraße 12, 48155 Münster' };

// winziges gültiges JPEG (1×1 Pixel), falls kein Testbild vorhanden ist
const MINI_JPEG = Uint8Array.from(
  Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
    'base64',
  ),
);
const testbild = process.env.TESTBILD && fs.existsSync(process.env.TESTBILD) ? new Uint8Array(fs.readFileSync(process.env.TESTBILD)) : MINI_JPEG;
const bild = async () => ({ bytes: testbild });

function punkt(o: Partial<ProtokollPunkt>): ProtokollPunkt {
  return {
    ...basis,
    id: o.id ?? Math.random().toString(),
    typ: 'protokollpunkt',
    protokollId: 'prot',
    threadId: 't',
    ursprungNr: 3,
    lfdNr: 1,
    thema: 'Thema',
    beschreibung: '',
    verantwortlich: '',
    frist: '',
    status: 'offen',
    fotoIds: [],
    planausschnittIds: [],
    ergaenzungen: [],
    reihenfolge: 1,
    rohtext: '',
    ki: 'manuell',
    ...o,
  };
}

function ablegen(name: string, bytes: Uint8Array) {
  const ziel = process.env.PDF_AUSGABE;
  if (ziel) fs.writeFileSync(path.join(ziel, name), bytes);
}

describe('PDF-Erzeugung', () => {
  it('Jour-Fixe-Protokoll: Kopf, Legende, Tabelle, Bilder unter dem Punkt, Seitenzahlen', async () => {
    const protokoll: Protokoll = { ...basis, id: 'prot', typ: 'protokoll', nr: 3, datum: '2026-11-06', teilnehmer: 'Hr. Lento (Bauleitung), Fr. Becker (Bauherr), Hr. Yilmaz (Trockenbau Yilmaz GmbH), Hr. Schmitz (Elektro Schmitz)', status: 'entwurf' };
    const punkte = [
      punkt({ id: 'a', ursprungNr: 3, lfdNr: 1, reihenfolge: 3, thema: 'Estrich 1. OG noch nicht abgeschlossen', beschreibung: 'Der Estrich im 1. OG ist noch nicht fertiggestellt. Die Restflächen im Flur werden bis Ende der Woche eingebracht.', verantwortlich: 'Estrich Meier', frist: '2026-11-13', fotoIds: ['f1', 'f2'] }),
      punkt({ id: 'b', ursprungNr: 1, lfdNr: 2, reihenfolge: 1, thema: 'Brandschutz: Schotts in Achse C', beschreibung: 'Die Brandschotts in Achse C sind nachzuweisen.', verantwortlich: 'Elektro Schmitz', frist: '2026-10-30', ergaenzungen: [{ id: 'e1', datum: '2026-10-23', text: 'Nachweis für das EG liegt vor.', protokollNr: 2 }, { id: 'e2', datum: '2026-11-06', text: '1. OG fehlt weiterhin, Frist wird nicht verlängert.', protokollNr: 3 }] }),
      punkt({ id: 'c', ursprungNr: 2, lfdNr: 1, reihenfolge: 2, thema: 'Planstand Lüftung Index C', beschreibung: 'Der aktuelle Planstand der Lüftung ist an alle Gewerke zu verteilen. „Sonderzeichen“ wie → oder 😀 dürfen das PDF nicht stören.', verantwortlich: 'Planung TGA', frist: '2026-11-20', ergaenzungen: [{ id: 'e3', datum: '2026-11-06', text: 'Verteilung erfolgt per E-Mail.', protokollNr: 3 }] }),
      punkt({ id: 'd', ursprungNr: 2, lfdNr: 4, reihenfolge: 4, thema: 'Bauzaun Nordseite', beschreibung: 'Der Bauzaun wurde versetzt.', status: 'erledigt', frist: '2026-10-28' }),
      ...Array.from({ length: 14 }, (_, i) => punkt({ id: `x${i}`, ursprungNr: 3, lfdNr: i + 2, reihenfolge: 10 + i, thema: `Weiterer Punkt ${i + 1}`, beschreibung: 'Sachlicher Satz zum Punkt, der über die Spaltenbreite hinaus umbrochen werden muss, damit der Zeilenumbruch geprüft wird.', verantwortlich: 'NU', frist: '2026-11-27' })),
    ];
    const bytes = await protokollPdf({ projekt, protokoll, punkte, bild, autor: 'Diego' });
    ablegen('JF_003_2026-11-06.pdf', bytes);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
    expect(doc.getTitle()).toBe('Jour-Fixe-Protokoll Nr. 3');
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });

  it('leeres Protokoll und sehr langer Text brechen nicht', async () => {
    const protokoll: Protokoll = { ...basis, id: 'prot', typ: 'protokoll', nr: 1, datum: '2026-11-06', teilnehmer: '', status: 'abgeschlossen' };
    const leer = await protokollPdf({ projekt, protokoll, punkte: [], bild, autor: 'Diego' });
    expect((await PDFDocument.load(leer)).getPageCount()).toBe(1);
    const lang = await protokollPdf({
      projekt,
      protokoll,
      punkte: [punkt({ ursprungNr: 1, thema: 'Langer Punkt', beschreibung: 'Wort '.repeat(4000) + 'EinSehrLangesWortOhneLeerzeichen'.repeat(20) })],
      bild,
      autor: 'Diego',
    });
    expect((await PDFDocument.load(lang)).getPageCount()).toBeGreaterThan(2);
  });

  it('Mängelliste je Firma', async () => {
    const mangel = (o: Partial<Mangel>): Mangel => ({ ...basis, id: String(o.nr), typ: 'mangel', nr: 1, titel: '', beschreibung: '', firmaId: null, firmaName: 'Trockenbau Yilmaz GmbH', ort: '', frist: '', status: 'offen', erledigtAm: '', fotoIds: [], planId: null, pin: null, ...o });
    const bytes = await maengelPdf({
      projekt,
      firma: 'Trockenbau Yilmaz GmbH',
      stand: '2026-11-10',
      maengel: [
        mangel({ nr: 1, titel: 'Revisionsklappe fehlt', beschreibung: 'Im Flur 1. OG fehlt die Revisionsklappe vor dem Brandschutzventil.', ort: '1.OG Flur', frist: '2026-11-05', fotoIds: ['f1'] }),
        mangel({ nr: 2, titel: 'Fuge nicht verspachtelt', ort: 'EG Raum 0.12', frist: '2026-11-20' }),
        mangel({ nr: 3, titel: 'Beschädigte Platte', ort: 'Halle', status: 'erledigt', erledigtAm: '2026-11-07' }),
      ],
      bild,
      autor: 'Diego',
    });
    ablegen('Maengelliste.pdf', bytes);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it('Bautagebuch', async () => {
    const tag: Bautag = { ...basis, id: 't', typ: 'bautag', datum: '2026-11-10', wetter: { beschreibung: 'Regen', tempMin: 4.2, tempMax: 9.1, niederschlag: 3.2, windMax: 35, quelle: 'dwd' }, firmen: [{ firmaId: null, name: 'Trockenbau Yilmaz GmbH', anzahl: 6 }, { firmaId: null, name: 'Elektro Schmitz', anzahl: 3 }], notiz: 'Estrich 1. OG eingebracht.\nLieferung Trockenbauplatten angenommen.', fotoIds: ['f1', 'f2', 'f3'] };
    const bytes = await bautagebuchPdf({ projekt, tage: [tag, { ...tag, id: 't2', datum: '2026-11-09', wetter: null, fotoIds: [] }], bild, autor: 'Diego' });
    ablegen('Bautagebuch.pdf', bytes);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
