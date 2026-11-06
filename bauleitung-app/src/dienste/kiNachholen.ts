/**
 * Holt die KI-Ausformulierung für Einträge nach, die ohne Netz erfasst wurden
 * (nur in Projekten mit "KI erlaubt"). Was du inzwischen selbst geändert hast,
 * wird nicht überschrieben.
 */
import { grossAnfang } from '../domain/schnellerfassung';
import { STANDARD_CHECKPUNKTE } from '../domain/stichwortzuordnung';
import type { BoardEintrag, Projekt, ProtokollPunkt } from '../domain/types';
import type { Repo } from '../data/repo';
import { ki as kiStandard, KiNichtVerfuegbar, type KiEinstellungen } from '../ki/client';

let laeuft = false;

export async function kiNachholen(opt: {
  repo: Repo;
  projekte: Projekt[];
  kiEinst: KiEinstellungen | null;
  neueId: () => string;
  ki?: typeof kiStandard;
}): Promise<number> {
  if (laeuft || !opt.kiEinst?.url) return 0;
  laeuft = true;
  const ki = opt.ki ?? kiStandard;
  let anzahl = 0;
  try {
    for (const projekt of opt.projekte.filter((p) => p.kiErlaubt)) {
      const eintraege = (await opt.repo.alle<BoardEintrag>('board', projekt.id)).filter((e) => e.ki === 'ausstehend');
      for (const e of eintraege) {
        const r = await ki.board(opt.kiEinst, e.rohtext);
        // Aktuellen Stand neu lesen (könnte sich inzwischen geändert haben)
        const akt = await opt.repo.hole<BoardEintrag>(e.id);
        if (!akt || akt.geloescht || akt.ki !== 'ausstehend') continue;
        const unberuehrt = akt.version === 1;
        const textUnveraendert = akt.titel === grossAnfang(akt.rohtext) && akt.text === akt.rohtext;
        const checkUnveraendert =
          akt.checkpunkte.every((c) => !c.erledigt) &&
          akt.checkpunkte.map((c) => c.text).join('|') === STANDARD_CHECKPUNKTE.join('|');
        await opt.repo.aendere<BoardEintrag>(akt, {
          ...(textUnveraendert ? { titel: r.titel, text: r.beschreibung } : {}),
          ...(unberuehrt ? { bereich: r.bereich, rubrik: r.rubrik } : {}),
          ...(akt.wochentag ? {} : { wochentag: r.wochentag }),
          ...(checkUnveraendert
            ? { checkpunkte: r.checkpunkte.map((text) => ({ id: opt.neueId(), text, erledigt: false })) }
            : {}),
          ki: 'fertig',
        });
        anzahl++;
      }
      const punkte = (await opt.repo.alle<ProtokollPunkt>('protokollpunkt', projekt.id)).filter((p) => p.ki === 'ausstehend');
      for (const p of punkte) {
        const r = await ki.jourfixe(opt.kiEinst, p.rohtext);
        const akt = await opt.repo.hole<ProtokollPunkt>(p.id);
        if (!akt || akt.geloescht || akt.ki !== 'ausstehend') continue;
        const unveraendert = akt.thema === grossAnfang(akt.rohtext) && akt.beschreibung === akt.rohtext;
        await opt.repo.aendere<ProtokollPunkt>(akt, {
          ...(unveraendert ? { thema: r.thema, beschreibung: r.beschreibung } : {}),
          ki: 'fertig',
        });
        anzahl++;
      }
    }
  } catch (e) {
    if (!(e instanceof KiNichtVerfuegbar)) throw e;
    // Kein Netz / KI nicht erreichbar: später erneut versuchen
  } finally {
    laeuft = false;
  }
  return anzahl;
}
