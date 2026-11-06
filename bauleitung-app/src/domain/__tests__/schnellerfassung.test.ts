import { analysiere, erkenneWochentag, zielOhneKi } from '../schnellerfassung';
import { ordneZu } from '../stichwortzuordnung';

const heute = new Date(2026, 10, 6, 12); // KW 45/2026

describe('KW im Text', () => {
  it('"kw40 Estrich 1.OG" → KW 40, "kw40" wird entfernt', () => {
    const a = analysiere('kw40 Estrich 1.OG', heute);
    expect(a.kw).toEqual({ jahr: 2026, woche: 40 });
    expect(a.text).toBe('Estrich 1.OG');
    expect(a.jf).toBe(false);
  });

  it.each(['KW40 Estrich', 'kw 40 Estrich', 'Kw-40 Estrich', 'Estrich kw40', 'Estrich (kw40)'])('erkennt "%s"', (t) => {
    const a = analysiere(t, heute);
    expect(a.kw).toEqual({ jahr: 2026, woche: 40 });
    expect(a.text).not.toMatch(/kw/i);
    expect(a.text).toContain('Estrich');
  });

  it('kw in der Mitte: Leerzeichen werden aufgeräumt', () => {
    expect(analysiere('Estrich kw40 1.OG', heute).text).toBe('Estrich 1.OG');
  });

  it('kein "kw" in anderen Wörtern', () => {
    expect(analysiere('Dachkw12 prüfen', heute).kw).toBeNull();
    expect(analysiere('kw123 Test', heute).kw).toBeNull();
  });

  it('ungültige KW wird gemeldet', () => {
    const a = analysiere('kw54 Estrich', heute);
    expect(a.kw).toBeNull();
    expect(a.kwFehler).toBe('KW 54 gibt es nicht.');
  });

  it('ohne kw → keine KW (Eintrag geht in die aktuelle Woche)', () => {
    expect(analysiere('Estrich 1.OG', heute).kw).toBeNull();
  });
});

describe('Wochentag', () => {
  it('"Donnerstag Lieferung Trockenbau" → Donnerstag, Text bleibt', () => {
    const a = analysiere('Donnerstag Lieferung Trockenbau', heute);
    expect(a.wochentag).toBe('Donnerstag');
    expect(a.text).toBe('Donnerstag Lieferung Trockenbau');
  });
  it('"montags" zählt, "Montage" nicht', () => {
    expect(erkenneWochentag('montags Baubesprechung')).toBe('Montag');
    expect(erkenneWochentag('Montage Trockenbau 2.OG')).toBeNull();
    expect(erkenneWochentag('Freitagabend Betonage')).toBeNull();
  });
});

describe('"jf" am Anfang', () => {
  it('geht in den Jour Fixe, "jf" wird entfernt', () => {
    const a = analysiere('jf Estrich 1.OG noch nicht abgeschlossen', heute);
    expect(a.jf).toBe(true);
    expect(a.text).toBe('Estrich 1.OG noch nicht abgeschlossen');
  });
  it('"JF:" geht auch, kw bleibt im JF-Text erhalten', () => {
    const a = analysiere('JF: Estrich bis kw40 fertig', heute);
    expect(a.jf).toBe(true);
    expect(a.text).toBe('Estrich bis kw40 fertig');
    expect(a.kw).toBeNull();
  });
  it('"jf" nur am Anfang und als eigenes Wort', () => {
    expect(analysiere('Estrich jf', heute).jf).toBe(false);
    expect(analysiere('jfk Flughafen', heute).jf).toBe(false);
  });
});

describe('Ziel ohne KI', () => {
  it('jf → Jour Fixe, nur Foto → Foto, sonst Board', () => {
    expect(zielOhneKi({ jf: true, text: 'x' }, false)).toBe('jourfixe');
    expect(zielOhneKi({ jf: false, text: '' }, true)).toBe('foto');
    expect(zielOhneKi({ jf: false, text: 'Estrich' }, true)).toBe('board');
  });
});

describe('Stichwortzuordnung (Regeln aus dem Prototyp)', () => {
  it.each([
    ['Donnerstag Lieferung Trockenbau', 'bauleitung', 'Lieferungen'],
    ['Estrich 1.OG', 'bauleitung', 'Nachunternehmer'],
    ['Ausführungsplan Lüftung Revision C', 'bauleitung', 'Planung'],
    ['Bauzaun Nordseite versetzen', 'bauleitung', 'Baustelleneinrichtung'],
    ['Nachtrag Mehrmengen Erdaushub', 'projektleitung', 'Kosten'],
    ['Termin Abnahme Fassade', 'projektleitung', 'Termine'],
    ['Bauherr will Bemusterung', 'projektleitung', 'Bauherr'],
    ['Irgendwas anderes', 'bauleitung', 'Lieferungen'],
  ])('"%s" → %s / %s', (text, bereich, rubrik) => {
    expect(ordneZu(text)).toMatchObject({ bereich, rubrik });
  });

  it('"geplant" ist keine Planung', () => {
    expect(ordneZu('Estrich geplant für Mittwoch').rubrik).toBe('Nachunternehmer');
    expect(ordneZu('Estrich geplant für Mittwoch').wochentag).toBe('Mittwoch');
  });

  it('liefert Titel und Standard-Checkpunkte', () => {
    const z = ordneZu('estrich 1.OG');
    expect(z.titel).toBe('Estrich 1.OG');
    expect(z.checkpunkte).toEqual(['Vorleistung prüfen', 'Planunterlagen prüfen', 'Qualität nach Ausführung prüfen']);
  });
});
