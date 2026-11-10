import { filtereFotos, filterWerte, gruppiereFotos, LEERER_FILTER, OHNE, textPasst } from '../fotoFilter';
import { fotoBasisName, fotoOrdner, kwOrdner, mitNummer, naechsteNummer, nameTeil, pfadPasst } from '../fotoName';
import type { Foto } from '../types';

function foto(o: Partial<Foto>): Foto {
  return {
    id: o.id ?? 'x',
    typ: 'foto',
    projektId: 'p',
    erstelltVon: 'a',
    erstelltAm: '2026-11-06T10:00:00.000Z',
    geaendertVon: 'a',
    geaendertAm: '',
    version: 1,
    geloescht: false,
    datei: 'x.jpg',
    breite: 1,
    hoehe: 1,
    aufnahme: new Date(2026, 10, 6, 14).toISOString(),
    kw: '2026-W45',
    kwQuelle: 'exif',
    gewerk: 'Trockenbau',
    art: 'Detail',
    geschoss: '1.OG',
    tags: [],
    notiz: '',
    originalName: null,
    ki: 'manuell',
    ...o,
  };
}

describe('Sprechender Foto-Dateiname', () => {
  it('2026-11-06_KW45_Trockenbau_Detail_1OG_001.jpg im Ordner 02_Fotos/2026_KW45', () => {
    const f = foto({});
    expect(mitNummer(fotoBasisName(f), 1)).toBe('2026-11-06_KW45_Trockenbau_Detail_1OG_001.jpg');
    expect(fotoOrdner(f)).toBe('02_Fotos/2026_KW45');
  });

  it('ersetzt Zeichen, die OneDrive nicht erlaubt', () => {
    expect(nameTeil('Heizung/Lüftung')).toBe('Heizung-Lüftung');
    expect(nameTeil('1. OG West')).toBe('1-OG-West');
    expect(fotoBasisName(foto({ gewerk: 'Heizung/Lüftung', art: 'Übersicht', geschoss: null }))).toBe(
      '2026-11-06_KW45_Heizung-Lüftung_Übersicht',
    );
  });

  it('ohne Tags und ohne Datum', () => {
    const f = foto({ aufnahme: null, kw: null, gewerk: null, art: null, geschoss: null });
    expect(fotoBasisName(f)).toBe('ohne-Datum_KW-unbekannt_ohne-Gewerk_ohne-Art');
    expect(fotoOrdner(f)).toBe('02_Fotos/KW_unbekannt');
    expect(kwOrdner('2027-W02')).toBe('2027_KW02');
  });

  it('andere Ablagen', () => {
    expect(fotoOrdner(foto({ ablage: 'lieferschein' }))).toBe('07_Lieferscheine/2026_KW45');
    expect(fotoOrdner(foto({ ablage: 'anhang' }))).toBe('03_Protokolle/Anhaenge');
    expect(fotoBasisName(foto({ ablage: 'lieferschein', geschoss: null }))).toBe('2026-11-06_KW45_Lieferschein');
  });

  it('vergibt die nächste freie laufende Nummer', () => {
    const basis = '2026-11-06_KW45_Trockenbau_Detail_1OG';
    expect(naechsteNummer(basis, [])).toBe(1);
    expect(naechsteNummer(basis, [`${basis}_001.jpg`, `${basis}_003.jpg`, '2026-11-06_KW45_Elektro_Detail_009.jpg'])).toBe(4);
  });

  it('erkennt, ob der Pfad noch zu den Tags passt', () => {
    const pfad = '02_Fotos/2026_KW45/2026-11-06_KW45_Trockenbau_Detail_1OG_002.jpg';
    expect(pfadPasst(foto({ oneDrivePfad: pfad }))).toBe(true);
    expect(pfadPasst(foto({ oneDrivePfad: pfad, gewerk: 'Elektro' }))).toBe(false);
    expect(pfadPasst(foto({ oneDrivePfad: pfad, kw: '2026-W44' }))).toBe(false);
    expect(pfadPasst(foto({ oneDrivePfad: null }))).toBe(false);
  });
});

describe('Fotos filtern, gruppieren, suchen', () => {
  const fotos = [
    foto({ id: 'a', kw: '2026-W45', gewerk: 'Trockenbau', art: 'Detail', geschoss: '1.OG', notiz: 'Revisionsklappe Flur' }),
    foto({ id: 'b', kw: '2026-W45', gewerk: 'Elektro', art: 'Übersicht', geschoss: 'EG' }),
    foto({ id: 'c', kw: '2026-W44', gewerk: 'Trockenbau', art: 'Übersicht', geschoss: 'EG', tags: ['gespachtelt'] }),
    foto({ id: 'd', kw: null, gewerk: null, art: null, geschoss: null }),
    foto({ id: 'e', ablage: 'lieferschein' }),
  ];

  it('Filter sind kombinierbar', () => {
    const ids = (f: Partial<typeof LEERER_FILTER>) => filtereFotos(fotos, { ...LEERER_FILTER, ...f }).map((x) => x.id);
    expect(ids({})).toEqual(['a', 'b', 'c', 'd']); // Lieferschein-Foto gehört nicht zur Fotodoku
    expect(ids({ gewerk: 'Trockenbau' })).toEqual(['a', 'c']);
    expect(ids({ gewerk: 'Trockenbau', kw: '2026-W45' })).toEqual(['a']);
    expect(ids({ art: 'Übersicht', geschoss: 'EG' })).toEqual(['b', 'c']);
    expect(ids({ kw: 'unbekannt' })).toEqual(['d']);
    expect(ids({ gewerk: OHNE })).toEqual(['d']);
  });

  it('Suche über Tags, Notiz, Gewerk – ohne Rücksicht auf Groß/Klein und Umlaute', () => {
    const ids = (suche: string) => filtereFotos(fotos, { ...LEERER_FILTER, suche }).map((x) => x.id);
    expect(ids('revisionsklappe')).toEqual(['a']);
    expect(ids('GESPACHTELT')).toEqual(['c']);
    expect(ids('ubersicht eg')).toEqual(['b', 'c']);
    expect(textPasst('Außenanlage', 'aussen')).toBe(true);
  });

  it('gruppiert KW (neueste zuerst, Unbekannt am Ende) → Gewerk', () => {
    const g = gruppiereFotos(filtereFotos(fotos, LEERER_FILTER));
    expect(g.map((x) => x.kw)).toEqual(['2026-W45', '2026-W44', null]);
    expect(g[0].gewerke.map((x) => x.gewerk)).toEqual(['Elektro', 'Trockenbau']);
    expect(g[2].gewerke.map((x) => x.gewerk)).toEqual([null]);
  });

  it('liefert die vorhandenen Filterwerte', () => {
    const w = filterWerte(fotos);
    expect(w.kws).toEqual(['2026-W45', '2026-W44']);
    expect(w.gewerke).toEqual(['Elektro', 'Trockenbau']);
    expect(w.hatUnbekannteKw).toBe(true);
  });
});
