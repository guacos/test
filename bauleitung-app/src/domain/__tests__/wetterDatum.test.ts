import { datumDe, datumLang, parseDatum, plusTage } from '../datum';
import { tageswetter, wetterText } from '../wetter';

describe('Datum', () => {
  it('formatiert und liest deutsche Datumsangaben', () => {
    expect(datumDe('2026-11-06')).toBe('06.11.2026');
    expect(datumDe('')).toBe('–');
    expect(parseDatum('6.11.26')).toBe('2026-11-06');
    expect(parseDatum('06.11.2026')).toBe('2026-11-06');
    expect(parseDatum('2026-11-06')).toBe('2026-11-06');
    expect(parseDatum('31.02.2026')).toBeNull();
    expect(parseDatum('morgen')).toBeNull();
    expect(plusTage('2026-12-31', 1)).toBe('2027-01-01');
    expect(datumLang('2026-11-10')).toBe('Dienstag, 10.11.2026');
  });
});

describe('Tageswetter aus Stundenwerten (Arbeitszeit 6–18 Uhr)', () => {
  const stunde = (h: number, o: object) => ({ timestamp: new Date(2026, 10, 6, h).toISOString(), ...o });

  it('fasst Temperatur, Niederschlag, Wind und das prägende Wetter zusammen', () => {
    const w = tageswetter(
      [
        stunde(3, { temperature: -5, precipitation: 9, condition: 'snow' }), // nachts: zählt nicht
        stunde(7, { temperature: 4.2, precipitation: 0, wind_speed: 10, condition: 'dry' }),
        stunde(12, { temperature: 9.1, precipitation: 1.2, wind_gust_speed: 35.4, condition: 'rain' }),
        stunde(16, { temperature: 7, precipitation: 2, wind_speed: 20, condition: 'rain' }),
      ],
      '2026-11-06',
    );
    expect(w).toEqual({ beschreibung: 'Regen', tempMin: 4.2, tempMax: 9.1, niederschlag: 3.2, windMax: 35, quelle: 'dwd' });
    expect(wetterText(w)).toBe('Regen · 4,2 bis 9,1 °C · 3,2 mm · Wind bis 35 km/h');
  });

  it('ohne Werte für den Tag → null', () => {
    expect(tageswetter([stunde(12, { temperature: 5 })], '2026-11-07')).toBeNull();
    expect(wetterText(null)).toBe('');
  });
});
