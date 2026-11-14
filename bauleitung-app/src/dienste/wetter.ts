/**
 * Wetter fürs Bautagebuch: Daten des Deutschen Wetterdienstes über die offene
 * Schnittstelle Bright Sky (kein Konto, kein Schlüssel). Übertragen werden nur
 * Koordinaten und Datum – und nur, wenn im Projekt „Wetter automatisch“ eingeschaltet ist.
 */
import { tageswetter, type Stundenwert } from '../domain/wetter';
import type { Wetter } from '../domain/types';

export const WETTER_URL = process.env.EXPO_PUBLIC_WETTER_URL || 'https://api.brightsky.dev/weather';

export async function holeWetter(lat: number, lon: number, datum: string): Promise<Wetter | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const url = `${WETTER_URL}?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}&date=${datum}&tz=Europe%2FBerlin`;
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    const daten = (await r.json()) as { weather?: Stundenwert[] };
    return tageswetter(daten.weather ?? [], datum);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
