import { describe, expect, it } from 'vitest';
import { erstelleApp, gleich } from '../src/app';
import { KiFehler, pruefeAntwort, type KiAufruf } from '../src/ki';

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

describe('HTTP-Schnittstelle', () => {
  const ki: KiAufruf = async (aufgabe, text) =>
    aufgabe === 'jourfixe' ? { thema: 'Estrich 1.OG', beschreibung: text } : { ok: aufgabe };

  it('ohne richtigen Schlüssel: 401, die KI wird nicht aufgerufen', async () => {
    let aufgerufen = false;
    const app = erstelleApp(umgebung, async () => ((aufgerufen = true), {}));
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
    const app = erstelleApp(umgebung, async () => {
      throw new KiFehler('KI hat die Anfrage abgelehnt', 422);
    });
    const r = await app.fetch(anfrage('/v1/board', { text: 'x' }));
    expect(r.status).toBe(422);
  });

  it('Schlüsselvergleich', () => {
    expect(gleich('abc', 'abc')).toBe(true);
    expect(gleich('abc', 'abd')).toBe(false);
    expect(gleich('abc', 'abcd')).toBe(false);
  });
});
