import type { ProtokollPunkt } from '../types';
import { naechsteProtokollNr, offenerEntwurf, uebernehmePunkte } from '../uebernahme';

function punkt(p: Partial<ProtokollPunkt>): ProtokollPunkt {
  return {
    id: 'x',
    typ: 'protokollpunkt',
    projektId: 'p',
    erstelltVon: 'a',
    erstelltAm: '',
    geaendertVon: 'a',
    geaendertAm: '',
    version: 1,
    geloescht: false,
    protokollId: 'alt',
    threadId: 't',
    ursprungNr: 1,
    thema: 'Thema',
    beschreibung: 'Text',
    verantwortlich: 'NU',
    frist: '2026-11-10',
    status: 'offen',
    fotoIds: [],
    planausschnittIds: [],
    ergaenzungen: [],
    reihenfolge: 1,
    rohtext: '',
    ki: 'manuell',
    ...p,
  };
}

describe('Übernahme offener Punkte', () => {
  it('übernimmt nur offene, nicht gelöschte Punkte; Herkunft bleibt erhalten', () => {
    const alt = [
      punkt({ id: 'a', threadId: 'ta', ursprungNr: 1, reihenfolge: 2 }),
      punkt({ id: 'b', threadId: 'tb', status: 'erledigt' }),
      punkt({ id: 'c', threadId: 'tc', geloescht: true }),
      punkt({ id: 'd', threadId: 'td', ursprungNr: 3, reihenfolge: 1, ergaenzungen: [{ id: 'e', datum: '2026-10-30', text: 'Nachtrag', protokollNr: 3 }] }),
    ];
    const neu = uebernehmePunkte(alt, 'neu');
    expect(neu.map((p) => p.threadId)).toEqual(['td', 'ta']);
    expect(neu.map((p) => p.reihenfolge)).toEqual([1, 2]);
    expect(neu[0]).toMatchObject({ protokollId: 'neu', ursprungNr: 3, verantwortlich: 'NU', frist: '2026-11-10' });
    expect(neu[0].ergaenzungen).toHaveLength(1);
    // Kopie, keine Referenz auf das alte Protokoll
    neu[0].ergaenzungen[0].text = 'geändert';
    expect(alt[3].ergaenzungen[0].text).toBe('Nachtrag');
  });

  it('fortlaufende Nr. und offener Entwurf', () => {
    expect(naechsteProtokollNr([])).toBe(1);
    expect(naechsteProtokollNr([{ nr: 1 }, { nr: 3 }])).toBe(4);
    expect(offenerEntwurf([{ nr: 1, status: 'abgeschlossen' }, { nr: 2, status: 'entwurf' }])?.nr).toBe(2);
    expect(offenerEntwurf([{ nr: 1, status: 'entwurf' }, { nr: 2, status: 'abgeschlossen' }])).toBeUndefined();
  });
});
