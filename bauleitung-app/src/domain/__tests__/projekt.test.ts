import { projektOrdnerName, pruefeProjekt, sichererName, sortiereProjekte, LEERES_PROJEKT } from '../projekt';

describe('Projekt-Ordnername', () => {
  it('setzt {ProjektNr}_{Projektname} zusammen', () => {
    expect(projektOrdnerName({ nr: '2026-014', name: 'Neubau Halle Nord' })).toBe('2026-014_Neubau Halle Nord');
  });

  it('ersetzt Zeichen, die OneDrive nicht erlaubt', () => {
    expect(sichererName('A/B:C*D?E"F<G>H|I\\J')).toBe('A-B-C-D-E-F-G-H-I-J');
  });

  it('entfernt Punkte und Leerzeichen am Rand', () => {
    expect(sichererName('  .Halle Nord.  ')).toBe('Halle Nord');
    expect(sichererName('Halle   Nord')).toBe('Halle Nord');
  });
});

describe('Projekt prüfen', () => {
  it('verlangt Projekt-Nr. und Name', () => {
    const r = pruefeProjekt(LEERES_PROJEKT);
    expect(r.ok).toBe(false);
    expect(r.fehler.nr).toBeDefined();
    expect(r.fehler.name).toBeDefined();
  });

  it('lehnt doppelte Projekt-Nr. ab, aber nicht beim eigenen Projekt', () => {
    const andere = [{ id: 'a', nr: '2026-014' }];
    const d = { ...LEERES_PROJEKT, nr: '2026-014 ', name: 'X' };
    expect(pruefeProjekt(d, andere).fehler.nr).toBe('Diese Projekt-Nr. gibt es schon.');
    expect(pruefeProjekt(d, andere, 'a').ok).toBe(true);
  });

  it('KI ist bei einem neuen Projekt standardmäßig AUS', () => {
    expect(LEERES_PROJEKT.kiErlaubt).toBe(false);
  });
});

describe('Projektliste sortieren', () => {
  it('sortiert Projekt-Nummern natürlich', () => {
    const l = sortiereProjekte([
      { nr: 'P10', name: 'b' },
      { nr: 'P2', name: 'a' },
    ]);
    expect(l.map((p) => p.nr)).toEqual(['P2', 'P10']);
  });
});
