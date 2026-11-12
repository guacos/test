import { MemoryStore } from '../../data/RecordStore';
import { Repo } from '../../data/repo';
import type { BoardEintrag, Foto, Inhalt, Projekt, Unterlage } from '../../domain/types';
import { fotoAnlegen } from '../../dienste/fotos';
import { abgleichen, ablegen, ladeKonflikte, ladeFotoDatei, ladeUnterlage, loeseKonflikt, projektBeitreten, type SyncKontext } from '../engine';
import { TestDateien, TestWolke, type TestLaufwerk } from '../testLaufwerk';

interface Geraet extends SyncKontext {
  lw: TestLaufwerk;
  dateien: TestDateien;
  store: MemoryStore;
  neueId: () => string;
}

let zaehler = 0;
function geraet(wolke: TestWolke, konto: string, name: string): Geraet {
  const store = new MemoryStore();
  const neueId = () => `${name}-${++zaehler}`;
  const repo = new Repo(store, () => name, neueId);
  return { lw: wolke.laufwerk(konto), repo, dateien: new TestDateien(), store, neueId };
}

const projektDaten = { nr: '2026-014', name: 'Halle Nord', bauherr: 'Muster GmbH', adresse: '', kiErlaubt: false };
const eintrag = (_projektId: string, titel: string): Inhalt<BoardEintrag> =>
  ({
    kw: '2026-W40',
    bereich: 'bauleitung',
    rubrik: 'Nachunternehmer',
    titel,
    text: titel,
    wochentag: null,
    checkpunkte: [],
    pruefkette: { vorleistung: false, material: false, planstand: false, qualitaet: false },
    fotoIds: [],
    notiz: '',
    rohtext: titel,
    ki: 'manuell',
  });

const P = 'Bauleitung-App/2026-014_Halle Nord';

describe('Abgleich mit OneDrive', () => {
  it('legt die Ordnerstruktur an und lädt jeden Datensatz als eigene Datei hoch', async () => {
    const wolke = new TestWolke();
    const handy = geraet(wolke, 'diego', 'Handy');
    const p = await handy.repo.neu<Projekt>('projekt', null, projektDaten);
    const e = await handy.repo.neu<BoardEintrag>('board', p.id, eintrag(p.id, 'Estrich 1.OG'));

    const erg = await abgleichen(handy);
    expect(erg.fehler).toEqual([]);
    expect(erg.hoch).toBe(2);
    expect(handy.lw.ordnerPfade()).toEqual(
      expect.arrayContaining([
        'Bauleitung-App/_Einstellungen',
        'Bauleitung-App/_Kernteam/2026-014_Halle Nord/01_Unterlagen',
        `${P}/02_Fotos`,
        `${P}/03_Protokolle`,
        `${P}/04_Board`,
        `${P}/05_Maengel`,
        `${P}/06_Bautagebuch`,
        `${P}/07_Lieferscheine`,
        `${P}/_daten`,
      ]),
    );
    expect(handy.lw.pfade()).toEqual([`${P}/_daten/board/${e.id}.json`, `${P}/_daten/projekt.json`]);
    const datei = JSON.parse(handy.lw.text(`${P}/_daten/board/${e.id}.json`)!);
    expect(datei).toMatchObject({ titel: 'Estrich 1.OG', erstelltVon: 'Handy', version: 1 });
    expect(datei.geaendertAm).toBeTruthy();
    expect(await handy.store.ungesynct()).toHaveLength(0);
  });

  it('zweites Gerät desselben Kontos sieht das Projekt und kann es bearbeiten', async () => {
    const wolke = new TestWolke();
    const handy = geraet(wolke, 'diego', 'Handy');
    const mac = geraet(wolke, 'diego', 'Mac');
    const p = await handy.repo.neu<Projekt>('projekt', null, projektDaten);
    const e = await handy.repo.neu<BoardEintrag>('board', p.id, eintrag(p.id, 'Estrich 1.OG'));
    await abgleichen(handy);

    const erg = await abgleichen(mac);
    expect(erg.runter).toBe(2);
    expect(await mac.repo.alle('projekt')).toHaveLength(1);
    const amMac = (await mac.repo.hole<BoardEintrag>(e.id))!;
    expect(amMac.titel).toBe('Estrich 1.OG');

    await mac.repo.aendere(amMac, { titel: 'Estrich 1.OG – Belegreife prüfen' });
    await abgleichen(mac);
    await abgleichen(handy);
    expect((await handy.repo.hole<BoardEintrag>(e.id))!).toMatchObject({ titel: 'Estrich 1.OG – Belegreife prüfen', geaendertVon: 'Mac', version: 2 });
    expect(await ladeKonflikte(handy.store)).toHaveLength(0);
  });

  it('ein Abgleich ohne Änderungen lädt nichts erneut', async () => {
    const wolke = new TestWolke();
    const handy = geraet(wolke, 'diego', 'Handy');
    const p = await handy.repo.neu<Projekt>('projekt', null, projektDaten);
    await handy.repo.neu<BoardEintrag>('board', p.id, eintrag(p.id, 'A'));
    await abgleichen(handy);
    const erg = await abgleichen(handy);
    expect(erg).toMatchObject({ hoch: 0, runter: 0, fotos: 0, konflikte: 0, fehler: [] });
  });

  it('gleichzeitige Änderung auf zwei Geräten wird als Konflikt erkannt, nichts wird still überschrieben', async () => {
    const wolke = new TestWolke();
    const handy = geraet(wolke, 'diego', 'Handy');
    const mac = geraet(wolke, 'diego', 'Mac');
    const p = await handy.repo.neu<Projekt>('projekt', null, projektDaten);
    const e = await handy.repo.neu<BoardEintrag>('board', p.id, eintrag(p.id, 'Estrich'));
    await abgleichen(handy);
    await abgleichen(mac);

    // beide ändern offline denselben Eintrag
    await handy.repo.aendere((await handy.repo.hole<BoardEintrag>(e.id))!, { titel: 'Estrich (Handy)' });
    await mac.repo.aendere((await mac.repo.hole<BoardEintrag>(e.id))!, { titel: 'Estrich (Mac)' });
    await abgleichen(mac); // Mac ist zuerst online
    const erg = await abgleichen(handy);

    expect(erg.konflikte).toBe(1);
    const [k] = await ladeKonflikte(handy.store);
    expect((k.remote as BoardEintrag).titel).toBe('Estrich (Mac)');
    // lokal bleibt die eigene Version, in OneDrive die des Mac
    expect((await handy.repo.hole<BoardEintrag>(e.id))!.titel).toBe('Estrich (Handy)');
    expect(JSON.parse(handy.lw.text(`${P}/_daten/board/${e.id}.json`)!).titel).toBe('Estrich (Mac)');

    // ein weiterer Abgleich ändert daran nichts
    await abgleichen(handy);
    expect(JSON.parse(handy.lw.text(`${P}/_daten/board/${e.id}.json`)!).titel).toBe('Estrich (Mac)');
  });

  it('Konflikt lösen: meine Version / andere Version / beide behalten', async () => {
    for (const wahl of ['meine', 'andere', 'beide'] as const) {
      const wolke = new TestWolke();
      const handy = geraet(wolke, 'diego', 'Handy');
      const mac = geraet(wolke, 'diego', 'Mac');
      const p = await handy.repo.neu<Projekt>('projekt', null, projektDaten);
      const e = await handy.repo.neu<BoardEintrag>('board', p.id, eintrag(p.id, 'Estrich'));
      await abgleichen(handy);
      await abgleichen(mac);
      await handy.repo.aendere((await handy.repo.hole<BoardEintrag>(e.id))!, { titel: 'Handy' });
      await mac.repo.aendere((await mac.repo.hole<BoardEintrag>(e.id))!, { titel: 'Mac' });
      await abgleichen(mac);
      await abgleichen(handy);

      await loeseKonflikt(handy.store, e.id, wahl, handy.neueId);
      const erg = await abgleichen(handy);
      expect(erg.konflikte).toBe(0);
      await abgleichen(mac);
      const titelMac = (await mac.repo.alle<BoardEintrag>('board', p.id)).map((x) => x.titel).sort();
      const titelHandy = (await handy.repo.alle<BoardEintrag>('board', p.id)).map((x) => x.titel).sort();
      const erwartet = { meine: ['Handy'], andere: ['Mac'], beide: ['Handy', 'Mac'] }[wahl];
      expect(titelHandy).toEqual(erwartet);
      expect(titelMac).toEqual(erwartet);
    }
  });

  it('Löschen wird übertragen (Datei bleibt als Markierung erhalten)', async () => {
    const wolke = new TestWolke();
    const handy = geraet(wolke, 'diego', 'Handy');
    const mac = geraet(wolke, 'diego', 'Mac');
    const p = await handy.repo.neu<Projekt>('projekt', null, projektDaten);
    const e = await handy.repo.neu<BoardEintrag>('board', p.id, eintrag(p.id, 'Estrich'));
    await abgleichen(handy);
    await abgleichen(mac);
    await mac.repo.loesche((await mac.repo.hole<BoardEintrag>(e.id))!);
    await abgleichen(mac);
    await abgleichen(handy);
    expect(await handy.repo.alle('board', p.id)).toHaveLength(0);
  });

  it('Fotos: sprechender Name mit laufender Nummer, Umbenennen bei Tag-Änderung, Laden auf dem zweiten Gerät', async () => {
    const wolke = new TestWolke();
    const handy = geraet(wolke, 'diego', 'Handy');
    const mac = geraet(wolke, 'diego', 'Mac');
    const p = await handy.repo.neu<Projekt>('projekt', null, projektDaten);
    const bild = (datei: string) => ({
      datei,
      breite: 10,
      hoehe: 10,
      originalName: null,
      aufnahme: new Date(2026, 10, 6, 9).toISOString(),
      kw: '2026-W45',
      quelle: 'exif' as const,
    });
    handy.dateien.daten.set('a.jpg', new Uint8Array([1, 2, 3]));
    handy.dateien.daten.set('b.jpg', new Uint8Array([4, 5, 6]));
    const a = await fotoAnlegen(handy.repo, p, bild('a.jpg'), { gewerk: 'Trockenbau', geschoss: '1.OG' });
    const b = await fotoAnlegen(handy.repo, p, bild('b.jpg'), { gewerk: 'Trockenbau', geschoss: '1.OG' });
    await handy.repo.aendere(a, { art: 'Detail' });
    await handy.repo.aendere(b, { art: 'Detail' });

    const erg = await abgleichen(handy);
    expect(erg.fotos).toBe(2);
    const ordner = `${P}/02_Fotos/2026_KW45`;
    expect(handy.lw.pfade()).toEqual(
      expect.arrayContaining([
        `${ordner}/2026-11-06_KW45_Trockenbau_Detail_1OG_001.jpg`,
        `${ordner}/2026-11-06_KW45_Trockenbau_Detail_1OG_002.jpg`,
      ]),
    );
    expect((await handy.repo.hole<Foto>(a.id))!.oneDrivePfad).toBe('02_Fotos/2026_KW45/2026-11-06_KW45_Trockenbau_Detail_1OG_001.jpg');
    expect(await handy.store.ungesynct()).toHaveLength(0);

    // zweites Gerät: Datensatz kommt an, Bild wird bei Bedarf geladen
    await abgleichen(mac);
    const amMac = (await mac.repo.hole<Foto>(a.id))!;
    expect(await mac.dateien.existiert('a.jpg')).toBe(false);
    expect(await ladeFotoDatei(mac, amMac)).toBe(true);
    expect([...(await mac.dateien.bytes('a.jpg'))]).toEqual([1, 2, 3]);

    // Tag am Mac ändern → Datei wird umbenannt und in den richtigen KW-Ordner verschoben
    await mac.repo.aendere(amMac, { gewerk: 'Elektro', kw: '2026-W44' });
    await abgleichen(mac);
    expect(mac.lw.pfade()).toEqual(expect.arrayContaining([`${P}/02_Fotos/2026_KW44/2026-11-06_KW44_Elektro_Detail_1OG_001.jpg`]));
    expect(mac.lw.pfade()).not.toContain(`${ordner}/2026-11-06_KW45_Trockenbau_Detail_1OG_001.jpg`);

    // Foto löschen → Datei verschwindet aus OneDrive
    await handy.repo.loesche((await handy.repo.hole<Foto>(b.id))!);
    await abgleichen(handy);
    expect(handy.lw.pfade()).not.toContain(`${ordner}/2026-11-06_KW45_Trockenbau_Detail_1OG_002.jpg`);
  });

  it('PDFs aus der Ablage landen im richtigen Ordner, auch wenn sie offline erzeugt wurden', async () => {
    const wolke = new TestWolke();
    const handy = geraet(wolke, 'diego', 'Handy');
    const p = await handy.repo.neu<Projekt>('projekt', null, projektDaten);
    handy.lw.offline = true;
    await ablegen(handy.store, handy.dateien, { projektId: p.id, pfad: '03_Protokolle/JF_001_2026-11-06.pdf', bytes: new Uint8Array([37, 80, 68, 70]), typ: 'application/pdf' }, handy.neueId);
    await expect(abgleichen(handy)).rejects.toThrow('Keine Verbindung');
    handy.lw.offline = false;
    const erg = await abgleichen(handy);
    expect(erg.ablage).toBe(1);
    expect(handy.lw.pfade()).toContain(`${P}/03_Protokolle/JF_001_2026-11-06.pdf`);
    // erneut ablegen ersetzt die Datei
    await ablegen(handy.store, handy.dateien, { projektId: p.id, pfad: '03_Protokolle/JF_001_2026-11-06.pdf', bytes: new Uint8Array([1]), typ: 'application/pdf' }, handy.neueId);
    await abgleichen(handy);
    expect(handy.lw.pfade().filter((x) => x.endsWith('.pdf'))).toHaveLength(1);
  });

  it('Team: Kollege tritt per Freigabe-Link bei, sieht die Daten und kann mitarbeiten', async () => {
    const wolke = new TestWolke();
    const diego = geraet(wolke, 'diego', 'Diego');
    const kollege = geraet(wolke, 'kollege', 'Kollege');
    const p = await diego.repo.neu<Projekt>('projekt', null, projektDaten);
    const e = await diego.repo.neu<BoardEintrag>('board', p.id, eintrag(p.id, 'Estrich'));
    await abgleichen(diego);
    const link = wolke.teile('diego', P);

    await projektBeitreten(kollege, link);
    await abgleichen(kollege);
    expect((await kollege.repo.hole<BoardEintrag>(e.id))!.titel).toBe('Estrich');
    // der Kollege bekommt KEINEN eigenen Projektordner – er arbeitet im geteilten Ordner
    expect(kollege.lw.pfade().filter((x) => x.includes('Halle Nord'))).toEqual([]);

    await kollege.repo.neu<BoardEintrag>('board', p.id, eintrag(p.id, 'Vom Kollegen'));
    await abgleichen(kollege);
    await abgleichen(diego);
    expect((await diego.repo.alle<BoardEintrag>('board', p.id)).map((x) => [x.titel, x.erstelltVon]).sort()).toEqual([
      ['Estrich', 'Diego'],
      ['Vom Kollegen', 'Kollege'],
    ]);
  });

  it('Team: Verknüpfung in „Meine Dateien“ wird automatisch erkannt', async () => {
    const wolke = new TestWolke();
    const diego = geraet(wolke, 'diego', 'Diego');
    const kollege = geraet(wolke, 'kollege', 'Kollege');
    const p = await diego.repo.neu<Projekt>('projekt', null, projektDaten);
    await abgleichen(diego);
    kollege.lw.verknuepfe(wolke.teile('diego', P), '2026-014_Halle Nord');
    await abgleichen(kollege);
    expect((await kollege.repo.alle<Projekt>('projekt')).map((x) => x.id)).toEqual([p.id]);
  });

  it('Team: nur lesend geteilt → Daten kommen an, eigene Änderungen bleiben lokal mit Hinweis', async () => {
    const wolke = new TestWolke();
    const diego = geraet(wolke, 'diego', 'Diego');
    const gast = geraet(wolke, 'gast', 'Gast');
    const p = await diego.repo.neu<Projekt>('projekt', null, projektDaten);
    await diego.repo.neu<BoardEintrag>('board', p.id, eintrag(p.id, 'Estrich'));
    await abgleichen(diego);
    await projektBeitreten(gast, wolke.teile('diego', P, { nurLesen: true }));
    await abgleichen(gast);
    expect(await gast.repo.alle('board', p.id)).toHaveLength(1);
    await gast.repo.neu<BoardEintrag>('board', p.id, eintrag(p.id, 'Vom Gast'));
    const erg = await abgleichen(gast);
    expect(erg.fehler.join(' ')).toContain('keine Schreibrechte');
    expect(await gast.store.ungesynct()).toHaveLength(1);
    await abgleichen(diego);
    expect(await diego.repo.alle('board', p.id)).toHaveLength(1);
  });

  it('zwei Projekte mit gleichem Ordnernamen überschreiben sich nicht', async () => {
    const wolke = new TestWolke();
    const handy = geraet(wolke, 'diego', 'Handy');
    const mac = geraet(wolke, 'diego', 'Mac');
    await handy.repo.neu<Projekt>('projekt', null, projektDaten);
    await mac.repo.neu<Projekt>('projekt', null, projektDaten); // offline doppelt angelegt
    await abgleichen(handy);
    await abgleichen(mac);
    expect(mac.lw.ordnerPfade()).toEqual(expect.arrayContaining([P, `${P} (2)`]));
    expect(await mac.repo.alle('projekt')).toHaveLength(2);
  });

  it('Projekt umbenennen → Ordner in OneDrive wird umbenannt', async () => {
    const wolke = new TestWolke();
    const handy = geraet(wolke, 'diego', 'Handy');
    const p = await handy.repo.neu<Projekt>('projekt', null, projektDaten);
    await abgleichen(handy);
    await handy.repo.aendere(p, { name: 'Halle Süd' });
    await abgleichen(handy);
    expect(handy.lw.ordnerPfade()).toContain('Bauleitung-App/2026-014_Halle Süd');
    expect(handy.lw.ordnerPfade()).not.toContain(P);
    expect(handy.lw.ordnerPfade()).toContain('Bauleitung-App/_Kernteam/2026-014_Halle Süd/01_Unterlagen');
  });

  it('Unterlagen: Upload nach _Kernteam, Dateien aus OneDrive werden entdeckt, Laden für offline; Kollegen sehen die Dateien nicht', async () => {
    const wolke = new TestWolke();
    const handy = geraet(wolke, 'diego', 'Handy');
    const mac = geraet(wolke, 'diego', 'Mac');
    const p = await handy.repo.neu<Projekt>('projekt', null, projektDaten);
    handy.dateien.daten.set('u1', new Uint8Array([37, 80, 68, 70]));
    const u = await handy.repo.neu<Unterlage>('unterlage', p.id, { name: 'Grundriss: EG.pdf', datei: 'u1', mime: 'application/pdf', groesse: 4, art: 'Plan', planNr: 'A-101', index: 'B', notiz: '', oneDrivePfad: null });
    await abgleichen(handy);
    const K = 'Bauleitung-App/_Kernteam/2026-014_Halle Nord/01_Unterlagen';
    expect(handy.lw.pfade()).toContain(`${K}/Grundriss- EG.pdf`);
    expect((await handy.repo.hole<Unterlage>(u.id))!.oneDrivePfad).toBe('01_Unterlagen/Grundriss- EG.pdf');

    // Datei direkt in OneDrive abgelegt (z. B. am Mac im Finder), auch im Unterordner
    await handy.lw.schreibe(handy.lw.wurzel(), `${K}/LV/Leistungsverzeichnis.pdf`, new Uint8Array([1, 2, 3, 4, 5]));
    await handy.lw.schreibe(handy.lw.wurzel(), `${K}/notizen.txt`, 'x');
    await abgleichen(mac);
    const amMac = await mac.repo.alle<Unterlage>('unterlage', p.id);
    expect(amMac.map((x) => x.name).sort()).toEqual(['Grundriss: EG.pdf', 'Leistungsverzeichnis.pdf']);
    const lv = amMac.find((x) => x.name === 'Leistungsverzeichnis.pdf')!;
    expect(lv).toMatchObject({ oneDrivePfad: '01_Unterlagen/LV/Leistungsverzeichnis.pdf', groesse: 5, art: 'Sonstiges' });
    // kein doppelter Eintrag beim nächsten Abgleich – auch nicht auf dem anderen Gerät
    await abgleichen(mac);
    await abgleichen(handy);
    expect(await handy.repo.alle<Unterlage>('unterlage', p.id)).toHaveLength(2);

    // für die Offline-Ansicht laden
    expect(await mac.dateien.existiert(lv.datei)).toBe(false);
    expect(await ladeUnterlage(mac, lv)).toBe(true);
    expect([...(await mac.dateien.bytes(lv.datei))]).toEqual([1, 2, 3, 4, 5]);

    // Löschen in der App lässt die Datei in OneDrive – und sie taucht nicht wieder auf
    await mac.repo.loesche((await mac.repo.hole<Unterlage>(lv.id))!);
    await abgleichen(mac);
    await abgleichen(mac);
    expect(mac.lw.pfade()).toContain(`${K}/LV/Leistungsverzeichnis.pdf`);
    expect(await mac.repo.alle<Unterlage>('unterlage', p.id)).toHaveLength(1);

    // Kollege mit geteiltem Projektordner kommt nicht an die Dateien
    const kollege = geraet(wolke, 'kollege', 'Kollege');
    await projektBeitreten(kollege, wolke.teile('diego', P));
    await abgleichen(kollege);
    const beimKollegen = (await kollege.repo.alle<Unterlage>('unterlage', p.id))[0];
    expect(await ladeUnterlage(kollege, beimKollegen)).toBe(false);
  });
});
