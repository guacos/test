/**
 * Wetter fürs Bautagebuch: Tageswerte aus Stundenwerten des Deutschen Wetterdienstes
 * (abgerufen über Bright Sky). Betrachtet wird die Arbeitszeit 6–18 Uhr.
 */
import type { Wetter } from './types';

export interface Stundenwert {
  /** ISO-Zeitstempel */
  timestamp: string;
  temperature?: number | null;
  precipitation?: number | null;
  wind_speed?: number | null;
  wind_gust_speed?: number | null;
  condition?: string | null;
}

const BESCHREIBUNG: Record<string, string> = {
  dry: 'trocken',
  fog: 'Nebel',
  rain: 'Regen',
  sleet: 'Schneeregen',
  snow: 'Schnee',
  hail: 'Hagel',
  thunderstorm: 'Gewitter',
};

/** Rang für "das prägende Wetter des Tages": je höher, desto wichtiger zu nennen. */
const RANG: Record<string, number> = { dry: 0, fog: 1, rain: 2, sleet: 3, snow: 4, hail: 5, thunderstorm: 6 };

function runde(n: number): number {
  return Math.round(n * 10) / 10;
}

export function tageswetter(stunden: Stundenwert[], datum: string): Wetter | null {
  const tag = stunden.filter((s) => {
    const d = new Date(s.timestamp);
    if (isNaN(d.getTime())) return false;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return iso === datum && d.getHours() >= 6 && d.getHours() <= 18;
  });
  if (!tag.length) return null;
  const zahlen = (f: (s: Stundenwert) => number | null | undefined) =>
    tag.map(f).filter((n): n is number => typeof n === 'number' && isFinite(n));
  const temps = zahlen((s) => s.temperature);
  const regen = zahlen((s) => s.precipitation);
  const wind = zahlen((s) => s.wind_gust_speed ?? s.wind_speed);
  let praegend = 'dry';
  for (const s of tag) {
    const c = s.condition ?? 'dry';
    if ((RANG[c] ?? 0) > (RANG[praegend] ?? 0)) praegend = c;
  }
  const summe = regen.reduce((a, b) => a + b, 0);
  return {
    beschreibung: BESCHREIBUNG[praegend] ?? praegend,
    tempMin: temps.length ? runde(Math.min(...temps)) : null,
    tempMax: temps.length ? runde(Math.max(...temps)) : null,
    niederschlag: regen.length ? runde(summe) : null,
    windMax: wind.length ? Math.round(Math.max(...wind)) : null,
    quelle: 'dwd',
  };
}

/** "Regen · 4 bis 9 °C · 3,2 mm · Wind bis 35 km/h" */
export function wetterText(w: Wetter | null): string {
  if (!w) return '';
  const teile: string[] = [];
  if (w.beschreibung) teile.push(w.beschreibung);
  const z = (n: number) => String(n).replace('.', ',');
  if (w.tempMin !== null && w.tempMax !== null) teile.push(`${z(w.tempMin)} bis ${z(w.tempMax)} °C`);
  else if (w.tempMax !== null) teile.push(`${z(w.tempMax)} °C`);
  if (w.niederschlag !== null) teile.push(`${z(w.niederschlag)} mm`);
  if (w.windMax !== null) teile.push(`Wind bis ${w.windMax} km/h`);
  return teile.join(' · ');
}
