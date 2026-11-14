import {
  ergaenzungFarbe,
  protokollDateiname,
  punktFarbe,
  punktHinweis,
  punktNr,
  sortierePunkte,
  stichtag,
  zaehlePunkte,
} from '../farblogik';

const p = (o: Partial<{ status: 'offen' | 'erledigt'; frist: string; ursprungNr: number; reihenfolge: number }>) => ({
  status: 'offen' as const,
  frist: '',
  ursprungNr: 3,
  reihenfolge: 1,
  ...o,
});

describe('Farblogik Jour Fixe', () => {
  const stichtagIso = '2026-11-06';

  it('Dunkelblau = neu in diesem Protokoll', () => {
    expect(punktFarbe(p({ ursprungNr: 3 }), 3, stichtagIso)).toBe('blau');
    expect(punktHinweis(p({ ursprungNr: 3 }), 3, stichtagIso)).toBe('Neu in diesem Protokoll');
  });

  it('Schwarz = aus einem Vorprotokoll übernommen, mit "Offen seit Nr. X"', () => {
    expect(punktFarbe(p({ ursprungNr: 1 }), 3, stichtagIso)).toBe('schwarz');
    expect(punktHinweis(p({ ursprungNr: 1 }), 3, stichtagIso)).toBe('Offen seit Nr. 1');
  });

  it('Rot = Frist überschritten und noch offen – hat Vorrang vor Blau und Schwarz', () => {
    expect(punktFarbe(p({ ursprungNr: 3, frist: '2026-11-05' }), 3, stichtagIso)).toBe('rot');
    expect(punktFarbe(p({ ursprungNr: 1, frist: '2026-11-05' }), 3, stichtagIso)).toBe('rot');
    expect(punktHinweis(p({ ursprungNr: 1, frist: '2026-11-05' }), 3, stichtagIso)).toBe('Überfällig · Offen seit Nr. 1');
  });

  it('Frist am Stichtag selbst ist noch nicht überfällig; erledigte Punkte nie', () => {
    expect(punktFarbe(p({ frist: '2026-11-06' }), 3, stichtagIso)).toBe('blau');
    expect(punktFarbe(p({ frist: '2026-11-01', status: 'erledigt' }), 3, stichtagIso)).toBe('blau');
    expect(punktFarbe(p({ frist: '' }), 3, stichtagIso)).toBe('blau');
  });

  it('Ergänzungen: neu in diesem Protokoll = blau, ältere = schwarz', () => {
    expect(ergaenzungFarbe({ protokollNr: 3 }, 3)).toBe('blau');
    expect(ergaenzungFarbe({ protokollNr: 2 }, 3)).toBe('schwarz');
  });

  it('überfällige Punkte stehen oben, sonst gilt die Reihenfolge', () => {
    const liste = [
      { ...p({ reihenfolge: 1 }), id: 'a' },
      { ...p({ reihenfolge: 2, frist: '2026-11-01' }), id: 'b' },
      { ...p({ reihenfolge: 3 }), id: 'c' },
      { ...p({ reihenfolge: 4, frist: '2026-10-01' }), id: 'd' },
    ];
    expect(sortierePunkte(liste, stichtagIso).map((x) => x.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('Stichtag: aktuelles Protokoll = heute; ältere und PDF = Protokolldatum', () => {
    const prot = { datum: '2026-10-30' };
    expect(stichtag(prot, { istAktuell: true, fuerPdf: false, heute: '2026-11-06' })).toBe('2026-11-06');
    expect(stichtag(prot, { istAktuell: false, fuerPdf: false, heute: '2026-11-06' })).toBe('2026-10-30');
    expect(stichtag(prot, { istAktuell: true, fuerPdf: true, heute: '2026-11-06' })).toBe('2026-10-30');
  });

  it('zählt offene und überfällige Punkte', () => {
    const liste = [p({}), p({ frist: '2026-11-01' }), p({ status: 'erledigt', frist: '2026-11-01' })];
    expect(zaehlePunkte(liste, stichtagIso)).toEqual({ gesamt: 3, offen: 2, ueberfaellig: 1 });
  });

  it('Punkt-Nr. und PDF-Dateiname', () => {
    expect(punktNr({ ursprungNr: 3, lfdNr: 2 })).toBe('3.02');
    expect(protokollDateiname({ nr: 1, datum: '2026-11-06' })).toBe('JF_001_2026-11-06.pdf');
  });
});
