/**
 * Verbindung zum eigenen KI-Backend. Es wird nur das Nötigste geschickt:
 * der Kurztext bzw. ein verkleinertes Bild – keine Projektdaten.
 */
import type { Bereich, FotoArt, Wochentag } from '../domain/types';

export interface KiEinstellungen {
  /** z. B. https://bauleitung-ki.<name>.workers.dev */
  url: string;
  schluessel: string;
}

export interface KiBoard {
  bereich: Bereich;
  rubrik: string;
  titel: string;
  beschreibung: string;
  checkpunkte: string[];
  wochentag: Wochentag | null;
}

export interface KiJf {
  thema: string;
  beschreibung: string;
}

export interface KiErfassung {
  ziel: 'board' | 'jourfixe' | 'foto';
  board: KiBoard;
  jourfixe: KiJf;
}

export interface KiFoto {
  gewerk: string;
  art: FotoArt;
}

export interface KiLieferschein {
  lieferant: string;
  /** YYYY-MM-DD oder '' */
  datum: string;
  nummer: string;
  material: string;
  menge: string;
}

export class KiNichtVerfuegbar extends Error {}

async function rufe<T>(e: KiEinstellungen | null, pfad: string, body: object, timeoutMs = 30_000): Promise<T> {
  if (!e?.url || !e.schluessel) throw new KiNichtVerfuegbar('KI-Backend nicht eingerichtet');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${e.url.replace(/\/+$/, '')}${pfad}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${e.schluessel}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const fehler = (await r.json().catch(() => null)) as { fehler?: string } | null;
      throw new KiNichtVerfuegbar(fehler?.fehler ?? `KI-Fehler ${r.status}`);
    }
    return (await r.json()) as T;
  } catch (err) {
    if (err instanceof KiNichtVerfuegbar) throw err;
    throw new KiNichtVerfuegbar('KI nicht erreichbar');
  } finally {
    clearTimeout(t);
  }
}

export const ki = {
  erfassung: (e: KiEinstellungen | null, text: string, hatFoto: boolean) =>
    rufe<KiErfassung>(e, '/v1/erfassung', { text, hatFoto }),
  board: (e: KiEinstellungen | null, text: string) => rufe<KiBoard>(e, '/v1/board', { text }),
  jourfixe: (e: KiEinstellungen | null, text: string) => rufe<KiJf>(e, '/v1/jourfixe', { text }),
  foto: (e: KiEinstellungen | null, bild: string, gewerke: string[]) => rufe<KiFoto>(e, '/v1/foto', { bild, gewerke }, 60_000),
  lieferschein: (e: KiEinstellungen | null, bild: string) => rufe<KiLieferschein>(e, '/v1/lieferschein', { bild }, 60_000),
};

export type Ki = typeof ki;
