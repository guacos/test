import { datumAusDateiname, datumAusExif, fotoZeit } from '../fotoKw';

describe('Foto-KW', () => {
  it('EXIF-Datum hat Vorrang vor dem Dateinamen', () => {
    const z = fotoZeit({ exifDatum: '2026:11:06 14:23:05', dateiname: 'IMG_20260101_120000.jpg' });
    expect(z).toMatchObject({ kw: '2026-W45', quelle: 'exif' });
  });

  it('EXIF als Date-Objekt (Browser)', () => {
    expect(fotoZeit({ exifDatum: new Date(2026, 10, 6, 9) }).kw).toBe('2026-W45');
  });

  it.each([
    ['IMG_20261106_142305.jpg', '2026-W45'],
    ['2026-11-06 Baustelle.jpg', '2026-W45'],
    ['PXL_20261106_101010123.jpg', '2026-W45'],
    ['Screenshot_2027-01-01-10-00-00.png', '2026-W53'],
    ['WhatsApp Image 2026-03-02 at 10.11.12.jpeg', '2026-W10'],
  ])('Datum aus Dateiname "%s" → %s', (name, kw) => {
    expect(fotoZeit({ dateiname: name })).toMatchObject({ kw, quelle: 'dateiname' });
  });

  it('ungültige Daten im Namen werden ignoriert', () => {
    expect(datumAusDateiname('IMG_20261306.jpg')).toBeNull(); // Monat 13
    expect(datumAusDateiname('IMG_20260230.jpg')).toBeNull(); // 30. Februar
    expect(datumAusDateiname('DSC01234.jpg')).toBeNull();
  });

  it('ungültiges EXIF fällt auf den Dateinamen zurück', () => {
    expect(datumAusExif('0000:00:00 00:00:00')).toBeNull();
    expect(fotoZeit({ exifDatum: '0000:00:00 00:00:00', dateiname: 'IMG_20261106.jpg' }).quelle).toBe('dateiname');
  });

  it('ohne EXIF und ohne Datum im Namen → Unbekannt (kein Änderungsdatum der Datei)', () => {
    expect(fotoZeit({ dateiname: 'Foto.jpg' })).toEqual({ aufnahme: null, kw: null, quelle: 'unbekannt' });
  });

  it('App-Kamera ohne EXIF → Aufnahmezeitpunkt jetzt', () => {
    expect(fotoZeit({ kameraJetzt: new Date(2026, 10, 6, 8) })).toMatchObject({ kw: '2026-W45', quelle: 'kamera' });
  });
});
