import { aktuelleUnterlagen, groesseText, mitZaehler, planText, veralteteIds, vergleicheIndex } from '../unterlagen';

const u = (id: string, planNr: string, index: string, geaendertAm = '2026-11-01') => ({ id, planNr, index, geaendertAm });

describe('Aktueller Planindex', () => {
  it('vergleicht Buchstaben- und Zahlen-Indizes', () => {
    expect(vergleicheIndex('B', 'A')).toBeGreaterThan(0);
    expect(vergleicheIndex('a', 'A')).toBe(0);
    expect(vergleicheIndex('AA', 'Z')).toBeGreaterThan(0);
    expect(vergleicheIndex('10', '9')).toBeGreaterThan(0);
    expect(vergleicheIndex('', 'A')).toBeLessThan(0);
    expect(vergleicheIndex('03', '3')).toBe(0);
  });

  it('nur der höchste Index je Plan-Nr. ist aktuell; ohne Plan-Nr. immer aktuell', () => {
    const liste = [u('1', 'A-101', 'A'), u('2', 'A-101', 'C'), u('3', 'a-101 ', 'B'), u('4', 'A-102', ''), u('5', '', ''), u('6', '', '')];
    expect([...veralteteIds(liste)].sort()).toEqual(['1', '3']);
    expect(aktuelleUnterlagen(liste).map((x) => x.id)).toEqual(['2', '4', '5', '6']);
  });

  it('gleicher Index: der zuletzt geänderte gilt', () => {
    expect(aktuelleUnterlagen([u('1', 'P1', 'B', '2026-11-01'), u('2', 'P1', 'B', '2026-11-05')]).map((x) => x.id)).toEqual(['2']);
  });

  it('Hilfen', () => {
    expect(planText({ planNr: 'A-101', index: 'C' })).toBe('Plan-Nr. A-101 · Index C');
    expect(groesseText(1536 * 1024)).toBe('1,5 MB');
    expect(mitZaehler('Plan.pdf', 2)).toBe('Plan (2).pdf');
  });
});
