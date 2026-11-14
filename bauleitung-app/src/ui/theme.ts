/**
 * Gestaltung: ruhig und hochwertig, aber für draußen gebaut –
 * schwarzer Text auf Weiß (Sonnenlicht), große Tippflächen, klare Signalfarben.
 */
import { useWindowDimensions } from 'react-native';

export const farbe = {
  hintergrund: '#F2F4F7',
  karte: '#FFFFFF',
  flaeche: '#E8ECF1',
  text: '#0B1220',
  textLeise: '#434D5B',
  linie: '#C3CAD5',
  linieLeise: '#DDE2E9',
  /** Kopfzeile, Hauptfarbe */
  navy: '#0B2540',
  navyHell: '#17406B',
  navyZart: '#E7EDF5',
  /** Akzent für Haupt-Aktionen (weißer Text darauf: Kontrast > 5:1) */
  akzent: '#C2410C',
  akzentZart: '#FDEEE4',
  ok: '#1B6B34',
  okZart: '#E4F3E8',
  /** Jour-Fixe-Farblogik */
  neuBlau: '#0A2A6B',
  blauZart: '#E6ECFA',
  rot: '#B00020',
  rotZart: '#FCE8EB',
  gelb: '#7A4F00',
  gelbZart: '#FFF1CC',
  weiss: '#FFFFFF',
} as const;

export const groesse = {
  /** Mindesthöhe für Tippflächen (Daumen, Handschuh) */
  tippflaeche: 56,
  abstand: 16,
  radius: 14,
  radiusKlein: 10,
  schrift: 17,
  schriftKlein: 14.5,
  schriftGross: 21,
  titel: 26,
} as const;

/** Weicher Schatten für Karten (Android, Web). */
export const schatten = { boxShadow: '0px 2px 10px rgba(11, 37, 64, 0.08)' } as const;
export const schattenStark = { boxShadow: '0px 6px 18px rgba(11, 37, 64, 0.22)' } as const;

export type Ton = 'neutral' | 'ok' | 'rot' | 'blau' | 'gelb' | 'akzent' | 'navy';

export const TON: Record<Ton, { vorn: string; hinten: string }> = {
  neutral: { vorn: farbe.textLeise, hinten: farbe.flaeche },
  ok: { vorn: farbe.ok, hinten: farbe.okZart },
  rot: { vorn: farbe.rot, hinten: farbe.rotZart },
  blau: { vorn: farbe.neuBlau, hinten: farbe.blauZart },
  gelb: { vorn: farbe.gelb, hinten: farbe.gelbZart },
  akzent: { vorn: farbe.akzent, hinten: farbe.akzentZart },
  navy: { vorn: farbe.navy, hinten: farbe.navyZart },
};

/** Breiter Bildschirm (Mac/Tablet quer): Seitenleiste statt unterer Leiste, mehrspaltig. */
export function useBreit(): boolean {
  return useWindowDimensions().width >= 1000;
}

/** Jour Fixe: Farben der Punkte (rot = überfällig, blau = neu, schwarz = übernommen). */
export const FARBE_PUNKT = { rot: farbe.rot, blau: farbe.neuBlau, schwarz: farbe.text } as const;
