import { describe, expect, it } from 'vitest';
import { erstelleApp, gleich } from '../src/app';
import { fotoPruefung, LIEFERSCHEIN } from '../src/fachlich';
import { KiFehler, pruefe, pruefeAntwort, type Ki } from '../src/ki';

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

describe('HTTP-Schnittstelle', () => {
  const ki: Ki = {
    text: async (aufgabe, text) => (aufgabe === 'jourfixe' ? { thema: 'Estrich 1.OG', beschreibung: text } : { ok: aufgabe }),
    foto: async (_bild, gewerke) => ({ gewerk: gewerke[0], art: 'Detail' }),
    lieferschein: async () => ({ lieferant: 'Baustoff Nord', datum: '2026-11-04', nummer: 'LS-1', material: 'GK', menge: '10 St' }),
  };
  const fehlerKi = (f: () => never): Ki => ({ text: async () => f(), foto: async () => f(), lieferschein: async () => f() });

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

  it('Schlüsselvergleich', () => {
    expect(gleich('abc', 'abc')).toBe(true);
    expect(gleich('abc', 'abd')).toBe(false);
    expect(gleich('abc', 'abcd')).toBe(false);
  });
});
