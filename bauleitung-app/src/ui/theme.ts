/**
 * Farben und Größen für den Einsatz draußen:
 * hoher Kontrast (Sonnenlicht), große Schrift, große Tippflächen.
 */
export const farbe = {
  hintergrund: '#FFFFFF',
  flaeche: '#F2F2F0',
  text: '#000000',
  textLeise: '#3A3A3A',
  linie: '#1A1A1A',
  linieLeise: '#9A9A9A',
  /** Kopfzeile, Hauptfarbe */
  navy: '#0B2540',
  /** Akzent für Haupt-Aktionen (weißer Text darauf: Kontrast > 5:1) */
  akzent: '#B83A00',
  ok: '#1F6B2A',
  /** Jour-Fixe-Farblogik */
  neuBlau: '#0A2A6B',
  rot: '#B00020',
  weiss: '#FFFFFF',
} as const;

export const groesse = {
  /** Mindesthöhe für Tippflächen (Daumen, Handschuh) */
  tippflaeche: 56,
  abstand: 16,
  radius: 10,
  schrift: 18,
  schriftKlein: 15,
  schriftGross: 22,
  titel: 26,
} as const;
