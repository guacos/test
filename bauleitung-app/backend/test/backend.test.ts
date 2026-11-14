import { describe, expect, it } from 'vitest';
import { erstelleApp, gleich } from '../src/app';
import { fotoPruefung, KEINE_ANTWORT, LIEFERSCHEIN, pruefeFrageAntwort } from '../src/fachlich';
import { KiFehler, leseFrageAntwort, pruefe, pruefeAntwort, type Ki } from '../src/ki';

const umgebung = { APP_SCHLUESSEL: 'geheim', ERLAUBTE_URSPRUENGE: 'http://localhost:8081' };

function anfrage(pfad: string, body: unknown, schluessel = 'geheim') {
  return new Request(`http://x${pfad}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${schluessel}` },
    body: JSON.stringify(body),
  });
}

const boardJson = {
  bereich: 'bauleitung',
  rubrik: 'Lieferungen',
  titel: 'Lieferung Trockenbau am Donnerstag',
  beschreibung: 'Am Donnerstag wird Material für den Trockenbau angeliefert.',
  checkpunkte: ['Zuwegung prüfen', 'Lagerfläche definieren', 'Entladung organisieren', 'Vorleistung prüfen'],
  wochentag: 'Donnerstag',
};

describe('Antwort prüfen', () => {
  it('nimmt gültige Board-Antworten an und setzt "keiner" auf null', () => {
    expect(pruefeAntwort('board', JSON.stringify(boardJson))).toMatchObject({ rubrik: 'Lieferungen', wochentag: 'Donnerstag' });
    expect(pruefeAntwort('board', JSON.stringify({ ...boardJson, wochentag: 'keiner' }))).toMatchObject({ wochentag: null });
  });

  it('lehnt Rubriken ab, die nicht zum Bereich passen', () => {
    expect(() => pruefeAntwort('board', JSON.stringify({ ...boardJson, bereich: 'projektleitung' }))).toThrow(KiFehler);
  });

  it('kürzt Titel auf 8 Wörter und Checkpunkte auf 5', () => {
    const r = pruefeAntwort(
      'board',
      JSON.stringify({ ...boardJson, titel: 'eins zwei drei vier fünf sechs sieben acht neun', checkpunkte: ['a', 'b', 'c', 'd', 'e', 'f'] }),
    ) as { titel: string; checkpunkte: string[] };
    expect(r.titel.split(' ')).toHaveLength(8);
    expect(r.checkpunkte).toHaveLength(5);
  });

  it('kein JSON → Fehler', () => {
    expect(() => pruefeAntwort('jourfixe', 'Hallo')).toThrow('kein JSON');
  });
});

describe('Antwort prüfen: Foto und Lieferschein', () => {
  it('Gewerk muss aus der übergebenen Liste stammen', () => {
    const p = fotoPruefung(['Trockenbau', 'Elektro']);
    expect(pruefe(p, '{"gewerk":"Elektro","art":"Übersicht"}')).toEqual({ gewerk: 'Elektro', art: 'Übersicht' });
    expect(() => pruefe(p, '{"gewerk":"Zauberei","art":"Übersicht"}')).toThrow(KiFehler);
    expect(() => pruefe(p, '{"gewerk":"Elektro","art":"Panorama"}')).toThrow(KiFehler);
  });

  it('Lieferschein: nur ein echtes Datum wird durchgelassen', () => {
    const roh = { lieferant: ' Baustoff Nord ', datum: '04.11.2026', nummer: 'LS-1', material: 'GK', menge: '10' };
    expect(pruefe(LIEFERSCHEIN.pruefung, JSON.stringify(roh))).toMatchObject({ lieferant: 'Baustoff Nord', datum: '' });
    expect(pruefe(LIEFERSCHEIN.pruefung, JSON.stringify({ ...roh, datum: '2026-11-04' }))).toMatchObject({ datum: '2026-11-04' });
  });
});

describe('Fragen an die Unterlagen: Antwort nur mit Quelle', () => {
  const q = { dokument: 'Türliste.pdf', seiteVon: 3, seiteBis: 3, zitat: 'Stahltür T30: 12 Stück' };
  const textBlock = (text: string, citations: unknown[] | null) => ({ type: 'text', text, citations }) as never;
  const zitat = { type: 'page_location', cited_text: ' Stahltür T30: 12 Stück ', document_index: 0, document_title: 'Türliste.pdf', start_page_number: 3, end_page_number: 4, file_id: null };

  it('mit Fundstelle: Antwort und Quelle (Dokument, Seite)', () => {
    const r = leseFrageAntwort([textBlock('In der Halle sind ', null), textBlock('12 Stahltüren', [zitat, zitat]), textBlock(' vorgesehen.', null)], ['Türliste.pdf']);
    expect(r).toEqual({ gefunden: true, antwort: 'In der Halle sind 12 Stahltüren vorgesehen.', quellen: [q] });
  });

  it('ohne Fundstelle gilt der feste Satz – auch wenn die KI trotzdem etwas behauptet', () => {
    expect(leseFrageAntwort([textBlock('Vermutlich etwa 10 Türen.', null)], ['a.pdf'])).toEqual({ gefunden: false, antwort: KEINE_ANTWORT, quellen: [] });
    expect(pruefeFrageAntwort('', [q]).gefunden).toBe(false);
  });

  it('"Weiß ich nicht" bleibt "Weiß ich nicht", selbst mit Fundstelle', () => {
    expect(pruefeFrageAntwort('Weiß ich nicht – nicht in den Unterlagen gefunden.', [q])).toEqual({ gefunden: false, antwort: KEINE_ANTWORT, quellen: [] });
  });
});

describe('HTTP-Schnittstelle', () => {
  const ki: Ki = {
    text: async (aufgabe, text) => (aufgabe === 'jourfixe' ? { thema: 'Estrich 1.OG', beschreibung: text } : { ok: aufgabe }),
    foto: async (_bild, gewerke) => ({ gewerk: gewerke[0], art: 'Detail' }),
    lieferschein: async () => ({ lieferant: 'Baustoff Nord', datum: '2026-11-04', nummer: 'LS-1', material: 'GK', menge: '10 St' }),
    frage: async (frage, dok) => ({ gefunden: true, antwort: `${dok.length} Dokument(e): ${frage}`, quellen: [] }),
  };
  const fehlerKi = (f: () => never): Ki => ({ text: async () => f(), foto: async () => f(), lieferschein: async () => f(), frage: async () => f() });

  it('ohne richtigen Schlüssel: 401, die KI wird nicht aufgerufen', async () => {
    let aufgerufen = false;
    const app = erstelleApp(umgebung, fehlerKi(() => {
      aufgerufen = true;
      throw new Error('darf nicht aufgerufen werden');
    }));
    const r = await app.fetch(anfrage('/v1/board', { text: 'x' }, 'falsch'));
    expect(r.status).toBe(401);
    expect(aufgerufen).toBe(false);
  });

  it('gültige Anfrage wird beantwortet', async () => {
    const r = await erstelleApp(umgebung, ki).fetch(anfrage('/v1/jourfixe', { text: 'Estrich 1.OG nicht fertig' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ thema: 'Estrich 1.OG', beschreibung: 'Estrich 1.OG nicht fertig' });
  });

  it('leerer Text → 400', async () => {
    const r = await erstelleApp(umgebung, ki).fetch(anfrage('/v1/board', { text: '  ' }));
    expect(r.status).toBe(400);
  });

  it('KI-Fehler wird mit Status weitergegeben', async () => {
    const app = erstelleApp(umgebung, fehlerKi(() => {
      throw new KiFehler('KI hat die Anfrage abgelehnt', 422);
    }));
    const r = await app.fetch(anfrage('/v1/board', { text: 'x' }));
    expect(r.status).toBe(422);
  });

  it('Foto taggen und Lieferschein lesen', async () => {
    const bild = 'A'.repeat(200);
    const app = erstelleApp(umgebung, ki);
    const f = await app.fetch(anfrage('/v1/foto', { bild, gewerke: ['Trockenbau', 'Elektro'] }));
    expect(await f.json()).toEqual({ gewerk: 'Trockenbau', art: 'Detail' });
    const l = await app.fetch(anfrage('/v1/lieferschein', { bild }));
    expect((await l.json()) as object).toMatchObject({ lieferant: 'Baustoff Nord', nummer: 'LS-1' });
    // ungültige Eingaben
    expect((await app.fetch(anfrage('/v1/foto', { bild, gewerke: [] }))).status).toBe(400);
    expect((await app.fetch(anfrage('/v1/foto', { bild: 'kein base64 !!', gewerke: ['A'] }))).status).toBe(400);
    expect((await app.fetch(anfrage('/v1/lieferschein', {}))).status).toBe(400);
  });

  it('Frage an die Unterlagen: Eingaben werden geprüft', async () => {
    const pdf = 'A'.repeat(200);
    const app = erstelleApp(umgebung, ki);
    const r = await app.fetch(anfrage('/v1/frage', { frage: 'Wie viele Stahltüren?', dokumente: [{ name: 'a.pdf', pdf }] }));
    expect(await r.json()).toMatchObject({ gefunden: true, antwort: '1 Dokument(e): Wie viele Stahltüren?' });
    expect((await app.fetch(anfrage('/v1/frage', { frage: 'Wie viele?', dokumente: [] }))).status).toBe(400);
    expect((await app.fetch(anfrage('/v1/frage', { frage: 'x', dokumente: [{ name: 'a.pdf', pdf }] }))).status).toBe(400);
  });

  it('Schlüsselvergleich', () => {
    expect(gleich('abc', 'abc')).toBe(true);
    expect(gleich('abc', 'abd')).toBe(false);
    expect(gleich('abc', 'abcd')).toBe(false);
  });
});
