import { ausSchluessel, isoKw, kwSchluessel, kwText, montag, naechsteKw, plusWochen, wochenImJahr } from '../kw';

const d = (j: number, m: number, t: number) => new Date(j, m - 1, t, 12);

describe('ISO-Kalenderwoche', () => {
  it.each([
    [d(2026, 11, 6), 2026, 45],
    [d(2026, 1, 1), 2026, 1], // Donnerstag
    [d(2027, 1, 1), 2026, 53], // Freitag → KW 53 des Vorjahres
    [d(2027, 1, 4), 2027, 1],
    [d(2025, 12, 29), 2026, 1], // Montag → schon KW 1/2026
    [d(2026, 12, 31), 2026, 53],
    [d(2024, 12, 30), 2025, 1],
  ])('%s → %i/KW %i', (datum, jahr, woche) => {
    expect(isoKw(datum)).toEqual({ jahr, woche });
  });

  it('kennt Jahre mit 53 Wochen', () => {
    expect(wochenImJahr(2026)).toBe(53);
    expect(wochenImJahr(2027)).toBe(52);
    expect(wochenImJahr(2020)).toBe(53);
  });

  it('Schlüssel sortieren chronologisch und lassen sich zurücklesen', () => {
    expect(kwSchluessel({ jahr: 2026, woche: 4 })).toBe('2026-W04');
    expect(ausSchluessel('2026-W04')).toEqual({ jahr: 2026, woche: 4 });
    expect(ausSchluessel('2027-W53')).toBeNull();
    expect(['2027-W01', '2026-W40', '2026-W09'].sort()).toEqual(['2026-W09', '2026-W40', '2027-W01']);
  });

  it('Montag der KW', () => {
    const m = montag({ jahr: 2026, woche: 45 });
    expect([m.getFullYear(), m.getMonth() + 1, m.getDate()]).toEqual([2026, 11, 2]);
  });

  it('plusWochen über den Jahreswechsel', () => {
    expect(plusWochen({ jahr: 2026, woche: 53 }, 1)).toEqual({ jahr: 2027, woche: 1 });
    expect(plusWochen({ jahr: 2027, woche: 1 }, -1)).toEqual({ jahr: 2026, woche: 53 });
  });
});

describe('"kw40" ohne Jahr → nächstgelegene KW', () => {
  const heute = d(2026, 11, 6); // KW 45/2026

  it('kw40 → 2026 (5 Wochen zurück)', () => expect(naechsteKw(40, heute)).toEqual({ jahr: 2026, woche: 40 }));
  it('kw2 → 2027 (9 Wochen voraus)', () => expect(naechsteKw(2, heute)).toEqual({ jahr: 2027, woche: 2 }));
  it('kw45 → diese Woche', () => expect(naechsteKw(45, heute)).toEqual({ jahr: 2026, woche: 45 }));
  it('kw53 → 2026 (2027 hat keine KW 53)', () => expect(naechsteKw(53, heute)).toEqual({ jahr: 2026, woche: 53 }));
  it('kw54 und kw0 gibt es nicht', () => {
    expect(naechsteKw(54, heute)).toBeNull();
    expect(naechsteKw(0, heute)).toBeNull();
  });
  it('Anfang Januar: kw50 → Vorjahr', () => expect(naechsteKw(50, d(2027, 1, 12))).toEqual({ jahr: 2026, woche: 50 }));
  it('Anzeige mit Jahr nur bei anderem Jahr', () => {
    expect(kwText({ jahr: 2026, woche: 40 }, heute)).toBe('KW 40');
    expect(kwText({ jahr: 2027, woche: 2 }, heute)).toBe('KW 2/2027');
  });
});
