/**
 * Holt KI-Arbeit nach (nur in Projekten mit "KI erlaubt"):
 *  - Ausformulierung von Board-Einträgen und Jour-Fixe-Punkten, die ohne Netz erfasst wurden
 *  - Tag-Vorschläge (Gewerk, Art) für neue Fotos
 * Was du inzwischen selbst geändert hast, wird nicht überschrieben.
 */
import { grossAnfang } from '../domain/schnellerfassung';
import { STANDARD_CHECKPUNKTE } from '../domain/stichwortzuordnung';
import { istIsoDatum } from '../domain/datum';
import { FOTO_ARTEN, type BoardEintrag, type Foto, type Lieferschein, type Projekt, type ProtokollPunkt } from '../domain/types';
import type { Repo } from '../data/repo';
import { ki as kiStandard, KiNichtVerfuegbar, type Ki, type KiEinstellungen } from '../ki/client';

let laeuft = false;

export async function kiNachholen(opt: {
  repo: Repo;
  projekte: Projekt[];
  kiEinst: KiEinstellungen | null;
  neueId: () => string;
  gewerke?: string[];
  /** Liefert das verkleinerte Bild als Base64; fehlt die Funktion, werden Fotos übersprungen. */
  bildFuerKi?: (datei: string) => Promise<string>;
  ki?: Ki;
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

      if (opt.bildFuerKi && opt.gewerke?.length) {
        const fotos = (await opt.repo.alle<Foto>('foto', projekt.id)).filter((f) => f.ki === 'ausstehend');
        for (const f of fotos) {
          let bild: string;
          try {
            bild = await opt.bildFuerKi(f.datei);
          } catch {
            continue; // Bild (noch) nicht auf diesem Gerät
          }
          const r = await ki.foto(opt.kiEinst, bild, opt.gewerke);
          const akt = await opt.repo.hole<Foto>(f.id);
          if (!akt || akt.geloescht || akt.ki !== 'ausstehend') continue;
          const gewerk = opt.gewerke.includes(r.gewerk) ? r.gewerk : null;
          const art = FOTO_ARTEN.includes(r.art) ? r.art : null;
          const vorschlag = { ...(akt.gewerk ? {} : { gewerk }), ...(akt.art ? {} : { art }) };
          await opt.repo.aendere<Foto>(akt, {
            ...vorschlag,
            kiVorschlag: Object.values(vorschlag).some(Boolean),
            ki: 'fertig',
          });
          anzahl++;
        }
      }

      if (opt.bildFuerKi) {
        const scheine = (await opt.repo.alle<Lieferschein>('lieferschein', projekt.id)).filter((l) => l.ki === 'ausstehend' && l.fotoId);
        for (const l of scheine) {
          const foto = await opt.repo.holeAktiv<Foto>(l.fotoId);
          if (!foto) continue;
          let bild: string;
          try {
            bild = await opt.bildFuerKi(foto.datei);
          } catch {
            continue;
          }
          const r = await ki.lieferschein(opt.kiEinst, bild);
          const akt = await opt.repo.hole<Lieferschein>(l.id);
          if (!akt || akt.geloescht || akt.ki !== 'ausstehend') continue;
          // nur leere Felder füllen – was du schon eingetragen hast, bleibt
          await opt.repo.aendere<Lieferschein>(akt, {
            lieferant: akt.lieferant || r.lieferant,
            datum: akt.datum || (istIsoDatum(r.datum) ? r.datum : ''),
            nummer: akt.nummer || r.nummer,
            material: akt.material || r.material,
            menge: akt.menge || r.menge,
            ki: 'fertig',
          });
          anzahl++;
        }
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
