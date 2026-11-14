/**
 * Einfache Zuordnung per Stichwort (wenn die KI aus ist oder kein Netz da ist).
 * Regeln aus dem Prototyp übernommen, mit zwei Korrekturen:
 *  - "geplant" zählt nicht als Planung
 *  - Wochentag nur als ganzes Wort (siehe schnellerfassung.ts)
 */
import { grossAnfang, erkenneWochentag } from './schnellerfassung';
import type { Bereich, Wochentag } from './types';

export interface Zuordnung {
  bereich: Bereich;
  rubrik: string;
  titel: string;
  text: string;
  wochentag: Wochentag | null;
  checkpunkte: string[];
}

export const STANDARD_CHECKPUNKTE = ['Vorleistung prüfen', 'Planunterlagen prüfen', 'Qualität nach Ausführung prüfen'];

export function ordneZu(eingabe: string): Zuordnung {
  const t = eingabe.toLowerCase();
  const ohneGeplant = t.replace(/geplant[a-zäöüß]*/g, ' ');
  let bereich: Bereich = 'bauleitung';
  let rubrik = 'Lieferungen';
  if (/liefer/.test(t)) {
    rubrik = 'Lieferungen';
  } else if (/plan|ausführungsplan|revision/.test(ohneGeplant)) {
    rubrik = 'Planung';
  } else if (/\bbe\b|baustelleneinrichtung|kran|bauzaun|container/.test(t)) {
    rubrik = 'Baustelleneinrichtung';
  } else if (/\bnu\b|nachunternehmer|gewerk|trockenbau|elektro|sanitär|heizung|lüftung|maler|estrich/.test(t)) {
    rubrik = 'Nachunternehmer';
  } else if (/kosten|nachtrag|rechnung|budget/.test(t)) {
    bereich = 'projektleitung';
    rubrik = 'Kosten';
  } else if (/termin|frist|meilenstein/.test(t)) {
    bereich = 'projektleitung';
    rubrik = 'Termine';
  } else if (/bauherr/.test(t)) {
    bereich = 'projektleitung';
    rubrik = 'Bauherr';
  }
  return {
    bereich,
    rubrik,
    titel: grossAnfang(eingabe),
    text: eingabe,
    wochentag: erkenneWochentag(eingabe),
    checkpunkte: [...STANDARD_CHECKPUNKTE],
  };
}
