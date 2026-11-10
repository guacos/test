/** Jour-Fixe-Protokolle: anlegen (mit Übernahme), Punkte und Ergänzungen. */
import { heuteIso } from '../domain/datum';
import { grossAnfang } from '../domain/schnellerfassung';
import type { BaseRecord, Ergaenzung, KiStatus, Projekt, Protokoll, ProtokollPunkt } from '../domain/types';
import {
  letztesProtokoll,
  naechsteLfdNr,
  naechsteProtokollNr,
  offenerEntwurf,
  uebernehmePunkte,
} from '../domain/uebernahme';
import type { Repo } from '../data/repo';
import { ki as kiStandard, type Ki, type KiEinstellungen } from '../ki/client';

export async function punkteVon(repo: Repo, protokoll: Pick<Protokoll, 'id' | 'projektId'>): Promise<ProtokollPunkt[]> {
  return (await repo.alle<ProtokollPunkt>('protokollpunkt', protokoll.projektId)).filter((p) => p.protokollId === protokoll.id);
}

/**
 * Legt ein neues Protokoll an und übernimmt alle offenen Punkte des letzten Protokolls.
 * Ein noch offener Entwurf wird dabei abgeschlossen.
 */
export async function neuesProtokoll(repo: Repo, projektId: string, heute: Date = new Date(), erstellt: BaseRecord[] = []) {
  const protokolle = await repo.alle<Protokoll>('protokoll', projektId);
  const letztes = letztesProtokoll(protokolle);
  if (letztes && letztes.status === 'entwurf') await repo.aendere<Protokoll>(letztes, { status: 'abgeschlossen' });
  const protokoll = await repo.neu<Protokoll>('protokoll', projektId, {
    nr: naechsteProtokollNr(protokolle),
    datum: heuteIso(heute),
    teilnehmer: letztes?.teilnehmer ?? '',
    status: 'entwurf',
  });
  erstellt.push(protokoll);
  let uebernommen = 0;
  if (letztes) {
    for (const p of uebernehmePunkte(await punkteVon(repo, letztes), protokoll.id)) {
      erstellt.push(await repo.neu<ProtokollPunkt>('protokollpunkt', projektId, p));
      uebernommen++;
    }
  }
  return { protokoll, neuAngelegt: true, uebernommen };
}

/** Offenen Entwurf holen oder neu anlegen (für "jf …" in der Schnellerfassung). */
export async function sichereEntwurf(repo: Repo, projektId: string, heute: Date, erstellt: BaseRecord[] = []) {
  const entwurf = offenerEntwurf(await repo.alle<Protokoll>('protokoll', projektId));
  if (entwurf) return { protokoll: entwurf, neuAngelegt: false, uebernommen: 0 };
  return neuesProtokoll(repo, projektId, heute, erstellt);
}

/** Fügt einen neuen Punkt an (ohne KI-Aufruf). */
export async function punktAnlegen(
  repo: Repo,
  protokoll: Protokoll,
  felder: { thema: string; beschreibung: string; rohtext: string; ki: KiStatus; fotoIds?: string[] },
  neueId: () => string,
): Promise<ProtokollPunkt> {
  const punkte = await punkteVon(repo, protokoll);
  return repo.neu<ProtokollPunkt>('protokollpunkt', protokoll.projektId, {
    protokollId: protokoll.id,
    threadId: neueId(),
    ursprungNr: protokoll.nr,
    lfdNr: naechsteLfdNr(punkte, protokoll.nr),
    thema: felder.thema,
    beschreibung: felder.beschreibung,
    verantwortlich: '',
    frist: '',
    status: 'offen',
    fotoIds: felder.fotoIds ?? [],
    planausschnittIds: [],
    ergaenzungen: [],
    reihenfolge: punkte.reduce((m, p) => Math.max(m, p.reihenfolge), 0) + 1,
    rohtext: felder.rohtext,
    ki: felder.ki,
  });
}

/**
 * Kurzeingabe im Protokoll: Thema + ein sachlicher Satz (KI nur, wenn im Projekt erlaubt).
 * Ohne KI wird der Text unverändert übernommen.
 */
export async function punktAusKurztext(opt: {
  repo: Repo;
  projekt: Pick<Projekt, 'kiErlaubt'>;
  protokoll: Protokoll;
  text: string;
  kiEinst: KiEinstellungen | null;
  neueId: () => string;
  ki?: Ki;
}): Promise<{ punkt: ProtokollPunkt; hinweis: string | null }> {
  const text = opt.text.trim();
  let thema = grossAnfang(text);
  let beschreibung = text;
  let status: KiStatus = opt.projekt.kiErlaubt ? 'ausstehend' : 'manuell';
  let hinweis: string | null = null;
  if (opt.projekt.kiErlaubt) {
    try {
      const r = await (opt.ki ?? kiStandard).jourfixe(opt.kiEinst, text);
      thema = r.thema;
      beschreibung = r.beschreibung;
      status = 'fertig';
    } catch {
      hinweis = 'KI nicht erreichbar – Text unverändert übernommen. Die Ausformulierung wird nachgeholt.';
    }
  }
  const punkt = await punktAnlegen(opt.repo, opt.protokoll, { thema, beschreibung, rohtext: text, ki: status }, opt.neueId);
  return { punkt, hinweis };
}

/** Hängt eine Ergänzung mit Datum an – der bisherige Text bleibt stehen. */
export async function ergaenzungAnhaengen(
  repo: Repo,
  punktId: string,
  protokollNr: number,
  text: string,
  neueId: () => string,
  heute: Date = new Date(),
): Promise<ProtokollPunkt | undefined> {
  const t = text.trim();
  if (!t) return undefined;
  const e: Ergaenzung = { id: neueId(), datum: heuteIso(heute), text: t, protokollNr };
  return repo.aendereAktuell<ProtokollPunkt>(punktId, (akt) => ({ ergaenzungen: [...akt.ergaenzungen, e] }));
}

/** Löscht ein Protokoll samt seiner Punkte (als gelöscht markiert). */
export async function protokollLoeschen(repo: Repo, protokoll: Protokoll): Promise<void> {
  for (const p of await punkteVon(repo, protokoll)) await repo.loesche(p);
  await repo.loesche(protokoll);
}
