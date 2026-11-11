/**
 * Abgleich-Dienst der App: verbindet die Abgleich-Logik mit Microsoft Graph,
 * dem lokalen Speicher und der Anzeige (Status, Konflikte).
 */
import { create } from 'zustand';
import type { BaseRecord, Foto, Projekt } from '../domain/types';
import { bildBytes, existiertDatei, loescheBild, schreibeDatei } from '../foto/dateien';
import { neueId } from '../lib/id';
import { abmelden, anmelden, AnmeldeFehler, holeKonto, holeToken, type Konto } from '../ms/auth';
import { STANDARD_CLIENT_ID } from '../ms/config';
import { Graph, GraphFehler, NichtAngemeldet } from '../ms/graph';
import { GraphLaufwerk } from '../ms/laufwerk';
import { holeRepo, useApp } from '../state/useApp';
import {
  abgleichen,
  ablegen,
  ladeAblage,
  ladeFotoDatei,
  ladeKonflikte,
  loeseKonflikt,
  projektBeitreten,
  type Konflikt,
  type SyncDateien,
  type SyncErgebnis,
  type SyncKontext,
} from './engine';

export type SyncStatus = 'aus' | 'bereit' | 'laeuft' | 'offline' | 'fehler';

interface SyncState {
  konto: Konto | null;
  clientId: string;
  outlookGewuenscht: boolean;
  status: SyncStatus;
  /** Anzahl lokaler Änderungen, die noch nicht in OneDrive sind */
  offen: number;
  konflikte: number;
  /** ISO-Zeitpunkt des letzten erfolgreichen Abgleichs */
  letzter: string | null;
  meldungen: string[];
}

export const useSync = create<SyncState>(() => ({
  konto: null,
  clientId: STANDARD_CLIENT_ID,
  outlookGewuenscht: false,
  status: 'aus',
  offen: 0,
  konflikte: 0,
  letzter: null,
  meldungen: [],
}));

export const graph = new Graph(holeToken);
const laufwerk = new GraphLaufwerk(graph);
const dateien: SyncDateien = { bytes: bildBytes, schreibe: schreibeDatei, existiert: existiertDatei, loesche: loescheBild };

function kontext(): SyncKontext {
  return { lw: laufwerk, repo: holeRepo(), dateien };
}

const M_CLIENT = 'msClientId';
const M_OUTLOOK = 'msOutlook';
const M_LETZTER = 'syncLetzter';

let laeuft: Promise<SyncErgebnis | null> | null = null;
let nochmal = false;
let timer: ReturnType<typeof setTimeout> | null = null;

export async function zaehle(): Promise<void> {
  const store = holeRepo().store;
  const [dirty, konflikte, ablage] = await Promise.all([store.ungesynct(), ladeKonflikte(store), ladeAblage(store)]);
  useSync.setState({ offen: dirty.length + ablage.length, konflikte: konflikte.length });
}

/** Beim App-Start: gespeicherte Anmeldung und Einstellungen laden. */
export async function initSync(): Promise<void> {
  const repo = holeRepo();
  const [clientId, outlook, letzter, konto] = await Promise.all([
    repo.holeMeta(M_CLIENT),
    repo.holeMeta(M_OUTLOOK),
    repo.holeMeta(M_LETZTER),
    holeKonto(),
  ]);
  useSync.setState({
    clientId: clientId || STANDARD_CLIENT_ID,
    outlookGewuenscht: outlook === '1',
    letzter: letzter || null,
    konto,
    status: konto ? 'bereit' : 'aus',
  });
  // Steht noch der Gerätename als Ersteller da, den Namen des Microsoft-Kontos übernehmen
  if (konto?.name && /^Gerät [0-9a-f]{6}$/i.test(useApp.getState().autor)) {
    await useApp.getState().autorSetzen(konto.name);
  }
  repo.beiAenderung = () => {
    planeAbgleich();
    zaehle().catch(() => {});
  };
  await zaehle();
}

export async function setzeClientId(id: string): Promise<void> {
  useSync.setState({ clientId: id.trim() });
  await holeRepo().setzeMeta(M_CLIENT, id.trim());
}

export async function setzeOutlook(an: boolean): Promise<void> {
  useSync.setState({ outlookGewuenscht: an });
  await holeRepo().setzeMeta(M_OUTLOOK, an ? '1' : '0');
}

export async function anmeldenMs(): Promise<Konto> {
  const { clientId, outlookGewuenscht } = useSync.getState();
  const konto = await anmelden(clientId, outlookGewuenscht);
  useSync.setState({ konto, status: 'bereit', meldungen: [] });
  // Der Kontoname steht ab jetzt als Ersteller an den Einträgen
  if (konto.name) await useApp.getState().autorSetzen(konto.name);
  jetztAbgleichen().catch(() => {});
  return konto;
}

export async function abmeldenMs(): Promise<void> {
  await abmelden();
  useSync.setState({ konto: null, status: 'aus', meldungen: [] });
}

/** Startet den Abgleich. Läuft schon einer, wird danach noch einmal abgeglichen. */
export function jetztAbgleichen(): Promise<SyncErgebnis | null> {
  if (laeuft) {
    nochmal = true;
    return laeuft;
  }
  laeuft = (async () => {
    if (!useSync.getState().konto) {
      const konto = await holeKonto();
      if (!konto) return null;
      useSync.setState({ konto });
    }
    useSync.setState({ status: 'laeuft' });
    try {
      const erg = await abgleichen(kontext());
      const jetzt = new Date().toISOString();
      await holeRepo().setzeMeta(M_LETZTER, jetzt);
      useSync.setState({ status: erg.fehler.length ? 'fehler' : 'bereit', letzter: jetzt, meldungen: erg.fehler });
      if (erg.runter > 0 || erg.fotos > 0) {
        await useApp.getState().projekteNeuLaden();
        useApp.getState().geaendert();
      }
      return erg;
    } catch (e) {
      if (e instanceof NichtAngemeldet) {
        const konto = await holeKonto();
        useSync.setState({
          konto,
          status: konto ? 'fehler' : 'aus',
          meldungen: ['Die Microsoft-Anmeldung ist abgelaufen. Bitte unter „Mehr → Microsoft-Konto“ neu anmelden.'],
        });
      } else if (e instanceof GraphFehler && e.code === 'netz') {
        useSync.setState({ status: 'offline', meldungen: [] });
      } else {
        useSync.setState({ status: 'fehler', meldungen: [e instanceof Error ? e.message : String(e)] });
      }
      return null;
    } finally {
      await zaehle().catch(() => {});
    }
  })().finally(() => {
    laeuft = null;
    if (nochmal) {
      nochmal = false;
      planeAbgleich(500);
    }
  });
  return laeuft;
}

/** Abgleich in Kürze (mehrere Änderungen kurz hintereinander lösen nur einen Abgleich aus). */
export function planeAbgleich(ms = 5000): void {
  if (!useSync.getState().konto) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    jetztAbgleichen().catch(() => {});
  }, ms);
}

export interface KonfliktAnzeige extends Konflikt {
  lokal: BaseRecord | null;
}

export async function konflikteLaden(): Promise<KonfliktAnzeige[]> {
  const store = holeRepo().store;
  const liste = await ladeKonflikte(store);
  return Promise.all(liste.map(async (k) => ({ ...k, lokal: (await store.hole(k.id)) ?? null })));
}

export async function konfliktLoesen(id: string, wahl: 'meine' | 'andere' | 'beide'): Promise<void> {
  await loeseKonflikt(holeRepo().store, id, wahl, neueId);
  await useApp.getState().projekteNeuLaden();
  useApp.getState().geaendert();
  await zaehle();
  planeAbgleich(300);
}

/** Geteiltes Projekt über den Freigabe-Link hinzufügen. */
export async function beitreten(link: string): Promise<Projekt> {
  const p = await projektBeitreten(kontext(), link);
  await useApp.getState().projekteNeuLaden();
  await jetztAbgleichen();
  return p;
}

/** Erzeugte Datei (PDF) für OneDrive vormerken; wird hochgeladen, sobald Netz da ist. */
export async function dateiAblegen(projektId: string, pfad: string, bytes: Uint8Array, typ = 'application/pdf'): Promise<void> {
  await ablegen(holeRepo().store, dateien, { projektId, pfad, bytes, typ }, neueId);
  await zaehle();
  planeAbgleich(1000);
}

const nachladen = new Map<string, Promise<boolean>>();

/** Lädt ein Foto aus OneDrive nach, das auf diesem Gerät noch fehlt. */
export function fotoNachladen(foto: Pick<Foto, 'projektId' | 'oneDrivePfad' | 'datei'>): Promise<boolean> {
  if (!useSync.getState().konto || !foto.oneDrivePfad) return Promise.resolve(false);
  let p = nachladen.get(foto.datei);
  if (!p) {
    p = ladeFotoDatei(kontext(), foto)
      .catch(() => false)
      .finally(() => nachladen.delete(foto.datei));
    nachladen.set(foto.datei, p);
  }
  return p;
}

export { AnmeldeFehler };
