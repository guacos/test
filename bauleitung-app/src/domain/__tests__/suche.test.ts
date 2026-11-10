import { bezeichnung, suche, unterschiede } from '../suche';
import type { BaseRecord, BoardEintrag, Mangel, ProtokollPunkt } from '../types';

const basis = { projektId: 'p', erstelltVon: 'a', erstelltAm: '', geaendertVon: 'a', geaendertAm: '2026-11-06', version: 1, geloescht: false };
const board = (o: Partial<BoardEintrag>): BoardEintrag => ({
  ...basis,
  id: 'b',
  typ: 'board',
  kw: '2026-W40',
  bereich: 'bauleitung',
  rubrik: 'Nachunternehmer',
  titel: 'Estrich 1.OG',
  text: '',
  wochentag: null,
  checkpunkte: [{ id: 'c', text: 'Belegreife prüfen', erledigt: false }],
  pruefkette: { vorleistung: false, material: false, planstand: false, qualitaet: false },
  fotoIds: [],
  notiz: '',
  rohtext: '',
  ki: 'manuell',
  ...o,
});

describe('Suche über alle Bereiche', () => {
  const punkt = { ...basis, id: 'j', typ: 'protokollpunkt', thema: 'Brandschutz', beschreibung: 'Schotts in Achse C', verantwortlich: 'Elektro Schmitz', ergaenzungen: [{ id: 'e', datum: '', text: 'Nachweis fehlt', protokollNr: 1 }] } as unknown as ProtokollPunkt;
  const mangel = { ...basis, id: 'm', typ: 'mangel', nr: 4, titel: 'Revisionsklappe fehlt', beschreibung: '', firmaName: 'Trockenbau Yilmaz', ort: '1.OG' } as unknown as Mangel;
  const alle: BaseRecord[] = [board({}), punkt, mangel, board({ id: 'x', titel: 'Gelöscht Estrich', geloescht: true })];

  it('findet Treffer in Titel, Checkpunkten, Ergänzungen, Firma', () => {
    expect(suche(alle, 'estrich').map((t) => t.rec.id)).toEqual(['b']);
    expect(suche(alle, 'belegreife').map((t) => t.rec.id)).toEqual(['b']);
    expect(suche(alle, 'nachweis').map((t) => t.rec.id)).toEqual(['j']);
    expect(suche(alle, 'yilmaz klappe').map((t) => t.rec.id)).toEqual(['m']);
    expect(suche(alle, 'kw 40').map((t) => t.rec.id)).toEqual(['b']);
  });

  it('leere Suche und Gelöschtes liefern nichts', () => {
    expect(suche(alle, '  ')).toEqual([]);
    expect(suche(alle, 'gelöscht')).toEqual([]);
  });

  it('Bezeichnungen', () => {
    expect(bezeichnung(mangel)).toBe('Mangel 4: Revisionsklappe fehlt');
    expect(bezeichnung(board({}))).toBe('Estrich 1.OG');
  });
});

describe('Unterschiede für die Konflikt-Anzeige', () => {
  it('zeigt nur geänderte Felder, lesbar', () => {
    const meine = board({ titel: 'Estrich (Handy)', checkpunkte: [{ id: 'c', text: 'Belegreife prüfen', erledigt: true }] });
    const andere = board({ titel: 'Estrich (Mac)', wochentag: 'Montag', version: 3 });
    expect(unterschiede(meine, andere)).toEqual([
      { feld: 'Titel', meine: 'Estrich (Handy)', andere: 'Estrich (Mac)' },
      { feld: 'Wochentag', meine: '–', andere: 'Montag' },
      { feld: 'Checkpunkte', meine: '☑ Belegreife prüfen', andere: '☐ Belegreife prüfen' },
    ]);
  });
});
