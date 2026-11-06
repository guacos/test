/**
 * Schnellerfassung: Kurztext (+ optional Foto) → Board-Eintrag, Jour-Fixe-Punkt oder nur Foto.
 * Funktioniert ohne Netz. Mit KI (nur wenn im Projekt erlaubt) wird ausformuliert;
 * ist die KI nicht erreichbar, greift die Stichwortzuordnung und die KI wird später nachgeholt.
 */
import { isoDatum, isoKw, kwSchluessel, kwText, ausSchluessel, kwTextAusSchluessel } from '../domain/kw';
import { analysiere, grossAnfang, zielOhneKi, type Ziel } from '../domain/schnellerfassung';
import { ordneZu } from '../domain/stichwortzuordnung';
import {
  BEREICHE,
  type BaseRecord,
  type BoardEintrag,
  type Foto,
  type KiStatus,
  type Projekt,
  type Protokoll,
  type ProtokollPunkt,
  type Woche,
} from '../domain/types';
import { letztesProtokoll, naechsteProtokollNr, offenerEntwurf, uebernehmePunkte } from '../domain/uebernahme';
import type { Repo } from '../data/repo';
import type { FotoZeit } from '../domain/fotoKw';
import { ki as kiStandard, type KiEinstellungen } from '../ki/client';

export interface ErfassungBild extends FotoZeit {
  datei: string;
  breite: number;
  hoehe: number;
  originalName: string | null;
}

export interface ErfassungKontext {
  repo: Repo;
  projekt: Projekt;
  kiEinst: KiEinstellungen | null;
  ki?: typeof kiStandard;
  neueId: () => string;
  heute?: Date;
}

export interface ErfassungErgebnis {
  ziel: Ziel;
  /** Alles, was angelegt wurde (für "Rückgängig") */
  erstellt: BaseRecord[];
  /** Der Haupt-Datensatz (für "Bearbeiten") */
  haupt: BaseRecord;
  /** Kurze Rückmeldung, z. B. "KW 40 · Bauleitung / Nachunternehmer" */
  zusammenfassung: string;
  /** Zusatzhinweis, z. B. "KI nicht erreichbar …" */
  hinweis: string | null;
}

export class ErfassungFehler extends Error {}

export async function erfasse(
  ctx: ErfassungKontext,
  eingabe: { text: string; bild?: ErfassungBild | null },
): Promise<ErfassungErgebnis> {
  const heute = ctx.heute ?? new Date();
  const ki = ctx.ki ?? kiStandard;
  const a = analysiere(eingabe.text, heute);
  const bild = eingabe.bild ?? null;
  if (a.kwFehler) throw new ErfassungFehler(a.kwFehler);
  if (!a.text && !bild) {
    throw new ErfassungFehler(a.kw || a.jf ? 'Bitte zusätzlich einen Inhalt angeben.' : 'Bitte Text eingeben oder Foto aufnehmen.');
  }

  const pid = ctx.projekt.id;
  const kiErlaubt = ctx.projekt.kiErlaubt;
  const erstellt: BaseRecord[] = [];
  let hinweis: string | null = null;

  // 1. Ziel und Inhalte bestimmen (KI nur, wenn im Projekt erlaubt)
  let ziel: Ziel = zielOhneKi(a, !!bild);
  let kiStatus: KiStatus = kiErlaubt ? 'ausstehend' : 'manuell';
  let board = a.text ? ordneZu(a.text) : null;
  let jf = { thema: grossAnfang(a.text), beschreibung: a.text };

  if (kiErlaubt && a.text) {
    try {
      if (a.jf) {
        jf = await ki.jourfixe(ctx.kiEinst, a.text);
      } else {
        const r = await ki.erfassung(ctx.kiEinst, a.text, !!bild);
        ziel = r.ziel === 'foto' && !bild ? 'board' : r.ziel;
        board = {
          bereich: r.board.bereich,
          rubrik: r.board.rubrik,
          titel: r.board.titel,
          text: r.board.beschreibung,
          wochentag: a.wochentag ?? r.board.wochentag,
          checkpunkte: r.board.checkpunkte,
        };
        jf = r.jourfixe;
      }
      kiStatus = 'fertig';
    } catch {
      hinweis = 'KI nicht erreichbar – einfache Zuordnung verwendet. Die Ausformulierung wird nachgeholt.';
    }
  }

  // 2. Foto speichern (ein gemeinsamer Fotobestand für Fotodoku, Board und Jour Fixe)
  let foto: Foto | null = null;
  if (bild) {
    foto = await ctx.repo.neu<Foto>('foto', pid, {
      datei: bild.datei,
      breite: bild.breite,
      hoehe: bild.hoehe,
      aufnahme: bild.aufnahme,
      kw: bild.kw,
      kwQuelle: bild.quelle,
      gewerk: null,
      art: null,
      geschoss: null,
      tags: [],
      notiz: ziel === 'foto' ? a.text : '',
      originalName: bild.originalName,
      oneDriveName: null,
      ki: kiErlaubt ? 'ausstehend' : 'manuell',
    });
    erstellt.push(foto);
  }
  const fotoIds = foto ? [foto.id] : [];

  // 3. Ziel anlegen
  if (ziel === 'foto' && foto) {
    return { ziel, erstellt, haupt: foto, zusammenfassung: `Foto · ${kwTextAusSchluessel(foto.kw, heute)}`, hinweis };
  }

  if (ziel === 'jourfixe') {
    const { protokoll, neuAngelegt, uebernommen } = await sichereEntwurf(ctx, heute, erstellt);
    const punkte = (await ctx.repo.alle<ProtokollPunkt>('protokollpunkt', pid)).filter((p) => p.protokollId === protokoll.id);
    const punkt = await ctx.repo.neu<ProtokollPunkt>('protokollpunkt', pid, {
      protokollId: protokoll.id,
      threadId: ctx.neueId(),
      ursprungNr: protokoll.nr,
      thema: jf.thema,
      beschreibung: jf.beschreibung,
      verantwortlich: '',
      frist: '',
      status: 'offen',
      fotoIds,
      planausschnittIds: [],
      ergaenzungen: [],
      reihenfolge: punkte.reduce((m, p) => Math.max(m, p.reihenfolge), 0) + 1,
      rohtext: a.text,
      ki: kiStatus,
    });
    erstellt.push(punkt);
    const zusatz = neuAngelegt
      ? ` – neu angelegt${uebernommen ? `, ${uebernommen} offene ${uebernommen === 1 ? 'Punkt' : 'Punkte'} übernommen` : ''}`
      : '';
    return { ziel, erstellt, haupt: punkt, zusammenfassung: `Jour Fixe Nr. ${protokoll.nr} (Entwurf)${zusatz}`, hinweis };
  }

  // Board
  const z = board ?? ordneZu(a.text);
  const kw = a.kw ?? isoKw(heute);
  const kwKey = kwSchluessel(kw);
  const wochen = await ctx.repo.alle<Woche>('woche', pid);
  if (!wochen.some((w) => w.kw === kwKey)) {
    erstellt.push(await ctx.repo.neu<Woche>('woche', pid, { kw: kwKey }));
  }
  const eintrag = await ctx.repo.neu<BoardEintrag>('board', pid, {
    kw: kwKey,
    bereich: z.bereich,
    rubrik: z.rubrik,
    titel: z.titel,
    text: z.text,
    wochentag: z.wochentag,
    checkpunkte: z.checkpunkte.map((text) => ({ id: ctx.neueId(), text, erledigt: false })),
    pruefkette: { vorleistung: false, material: false, planstand: false, qualitaet: false },
    fotoIds,
    notiz: '',
    rohtext: a.text,
    ki: kiStatus,
  });
  erstellt.push(eintrag);
  const teile = [kwText(kw, heute), `${BEREICHE[z.bereich].label} / ${z.rubrik}`];
  if (z.wochentag) teile.push(z.wochentag);
  return { ziel: 'board', erstellt, haupt: eintrag, zusammenfassung: teile.join(' · '), hinweis };
}

/** Offenen Entwurf holen oder neu anlegen (übernimmt die offenen Punkte des letzten Protokolls). */
async function sichereEntwurf(ctx: ErfassungKontext, heute: Date, erstellt: BaseRecord[]) {
  const pid = ctx.projekt.id;
  const protokolle = await ctx.repo.alle<Protokoll>('protokoll', pid);
  const entwurf = offenerEntwurf(protokolle);
  if (entwurf) return { protokoll: entwurf, neuAngelegt: false, uebernommen: 0 };
  return neuesProtokoll(ctx.repo, pid, protokolle, heute, erstellt);
}

/** Legt ein neues Protokoll an und übernimmt alle offenen Punkte des letzten Protokolls. */
export async function neuesProtokoll(
  repo: Repo,
  pid: string,
  protokolle: Protokoll[],
  heute: Date,
  erstellt: BaseRecord[] = [],
) {
  const letztes = letztesProtokoll(protokolle);
  const protokoll = await repo.neu<Protokoll>('protokoll', pid, {
    nr: naechsteProtokollNr(protokolle),
    datum: isoDatum(heute),
    teilnehmer: '',
    status: 'entwurf',
  });
  erstellt.push(protokoll);
  let uebernommen = 0;
  if (letztes) {
    const altePunkte = (await repo.alle<ProtokollPunkt>('protokollpunkt', pid)).filter((p) => p.protokollId === letztes.id);
    for (const p of uebernehmePunkte(altePunkte, protokoll.id)) {
      erstellt.push(await repo.neu<ProtokollPunkt>('protokollpunkt', pid, p));
      uebernommen++;
    }
  }
  return { protokoll, neuAngelegt: true, uebernommen };
}

/** Macht eine Erfassung rückgängig (in umgekehrter Reihenfolge). */
export async function rueckgaengig(repo: Repo, erstellt: BaseRecord[], loescheBild?: (datei: string) => Promise<void>) {
  for (const r of [...erstellt].reverse()) {
    const aktuell = await repo.hole<BaseRecord>(r.id);
    if (aktuell && !aktuell.geloescht) await repo.loesche(aktuell);
    if (r.typ === 'foto' && loescheBild) await loescheBild((r as Foto).datei);
  }
}

/** Für die Anzeige im Board: KW-Schlüssel → Text. */
export function kwAnzeige(kw: string, heute = new Date()) {
  const k = ausSchluessel(kw);
  return k ? kwText(k, heute) : kw;
}
