import { neueId } from '../lib/id';
import { create } from 'zustand';
import { sortiereProjekte } from '../domain/projekt';
import {
  EINSTELLUNGEN_ID,
  STANDARD_GESCHOSSE,
  STANDARD_GEWERKE,
  type Einstellungen,
  type Projekt,
  type ProjektDaten,
} from '../domain/types';
import { Repo } from '../data/repo';
import type { RecordStore } from '../data/RecordStore';
import { erzeugeStore } from '../data/store';
import type { KiEinstellungen } from '../ki/client';
import { kiNachholen } from '../dienste/kiNachholen';

const META_AKTIV = 'aktivesProjekt';
const META_AUTOR = 'autor';
const META_GERAET = 'geraet';
const META_KI = 'kiBackend';

interface AppState {
  bereit: boolean;
  fehler: string | null;
  projekte: Projekt[];
  aktivesProjektId: string | null;
  /** Name, der als Ersteller an jedem Datensatz steht. Später: Name des Microsoft-Kontos. */
  autor: string;
  /** Verbindung zum KI-Backend (nur genutzt in Projekten mit "KI erlaubt") */
  kiEinst: KiEinstellungen | null;
  /** Wird bei jeder Datenänderung erhöht → Bildschirme laden neu */
  datenStand: number;
  /** Im Board angezeigte KW (z. B. "2026-W40"), null = aktuelle Woche */
  boardKw: string | null;
  /** Konfigurierbare Listen (Gewerke, Geschosse) */
  gewerke: string[];
  geschosse: string[];

  init: (store?: RecordStore) => Promise<void>;
  projektSpeichern: (daten: ProjektDaten, id?: string) => Promise<Projekt>;
  projektLoeschen: (id: string) => Promise<void>;
  projektWaehlen: (id: string) => Promise<void>;
  autorSetzen: (name: string) => Promise<void>;
  kiEinstSetzen: (e: KiEinstellungen | null) => Promise<void>;
  /** Nach Änderungen aufrufen, damit die Anzeige neu lädt */
  geaendert: () => void;
  /** Ausstehende KI-Ausformulierungen nachholen (wenn Netz da ist) */
  nachholen: () => Promise<void>;
  /** Projektliste neu aus dem Speicher lesen (z. B. nach dem Abgleich) */
  projekteNeuLaden: () => Promise<void>;
  listenSpeichern: (listen: { gewerke?: string[]; geschosse?: string[] }) => Promise<void>;
}

let repo: Repo | null = null;

/** Zugriff auf die Datenschicht für andere Module. */
export function holeRepo(): Repo {
  if (!repo) throw new Error('App nicht initialisiert');
  return repo;
}

export const useApp = create<AppState>((set, get) => ({
  bereit: false,
  fehler: null,
  projekte: [],
  aktivesProjektId: null,
  autor: '',
  kiEinst: null,
  datenStand: 0,
  boardKw: null,
  gewerke: STANDARD_GEWERKE,
  geschosse: STANDARD_GESCHOSSE,

  async init(store) {
    if (get().bereit) return;
    try {
      const s = store ?? erzeugeStore();
      await s.init();
      let geraet = await s.holeMeta(META_GERAET);
      if (!geraet) {
        geraet = neueId().slice(0, 6);
        await s.setzeMeta(META_GERAET, geraet);
      }
      const autor = (await s.holeMeta(META_AUTOR)) || `Gerät ${geraet}`;
      repo = new Repo(s, () => get().autor);
      const projekte = sortiereProjekte(await repo.alle<Projekt>('projekt'));
      let aktiv = (await s.holeMeta(META_AKTIV)) ?? null;
      if (!projekte.some((p) => p.id === aktiv)) aktiv = projekte[0]?.id ?? null;
      const kiRoh = await s.holeMeta(META_KI);
      const kiEinst = kiRoh ? (JSON.parse(kiRoh) as KiEinstellungen) : null;
      const einst = await repo.holeAktiv<Einstellungen>(EINSTELLUNGEN_ID);
      set({
        bereit: true,
        projekte,
        aktivesProjektId: aktiv,
        autor,
        kiEinst,
        gewerke: einst?.gewerke?.length ? einst.gewerke : STANDARD_GEWERKE,
        geschosse: einst?.geschosse?.length ? einst.geschosse : STANDARD_GESCHOSSE,
      });
    } catch (e) {
      set({ fehler: e instanceof Error ? e.message : String(e) });
    }
  },

  async projektSpeichern(daten, id) {
    const r = holeRepo();
    const alt = id ? get().projekte.find((p) => p.id === id) : undefined;
    const p = alt ? await r.aendere<Projekt>(alt, daten) : await r.neu<Projekt>('projekt', null, daten);
    const projekte = sortiereProjekte([...get().projekte.filter((x) => x.id !== p.id), p]);
    set({ projekte });
    if (!alt || !get().aktivesProjektId) await get().projektWaehlen(p.id);
    return p;
  },

  async projektLoeschen(id) {
    const r = holeRepo();
    const alt = get().projekte.find((p) => p.id === id);
    if (!alt) return;
    await r.loesche(alt);
    const projekte = get().projekte.filter((p) => p.id !== id);
    set({ projekte });
    if (get().aktivesProjektId === id) {
      const naechstes = projekte[0]?.id ?? null;
      set({ aktivesProjektId: naechstes });
      await r.setzeMeta(META_AKTIV, naechstes ?? '');
    }
  },

  async projektWaehlen(id) {
    set({ aktivesProjektId: id });
    await holeRepo().setzeMeta(META_AKTIV, id);
  },

  async autorSetzen(name) {
    const n = name.trim();
    if (!n) return;
    set({ autor: n });
    await holeRepo().setzeMeta(META_AUTOR, n);
  },

  async kiEinstSetzen(e) {
    const sauber = e && e.url.trim() ? { url: e.url.trim(), schluessel: e.schluessel.trim() } : null;
    set({ kiEinst: sauber });
    await holeRepo().setzeMeta(META_KI, sauber ? JSON.stringify(sauber) : '');
  },

  geaendert() {
    set((s) => ({ datenStand: s.datenStand + 1 }));
  },

  async nachholen() {
    const { projekte, kiEinst, gewerke } = get();
    if (!kiEinst?.url || !projekte.some((p) => p.kiErlaubt)) return;
    // Bildverarbeitung erst hier laden (wird nur mit KI gebraucht)
    const { kiBild } = await import('../foto/aufnahme');
    const n = await kiNachholen({ repo: holeRepo(), projekte, kiEinst, neueId, gewerke, bildFuerKi: kiBild });
    if (n > 0) get().geaendert();
  },

  async projekteNeuLaden() {
    const r = holeRepo();
    const projekte = sortiereProjekte(await r.alle<Projekt>('projekt'));
    let aktiv = get().aktivesProjektId;
    if (!projekte.some((p) => p.id === aktiv)) aktiv = projekte[0]?.id ?? null;
    const einst = await r.holeAktiv<Einstellungen>(EINSTELLUNGEN_ID);
    set({
      projekte,
      aktivesProjektId: aktiv,
      ...(einst?.gewerke?.length ? { gewerke: einst.gewerke } : {}),
      ...(einst?.geschosse?.length ? { geschosse: einst.geschosse } : {}),
    });
  },

  async listenSpeichern(listen) {
    const r = holeRepo();
    const sauber = (l: string[]) => [...new Set(l.map((x) => x.trim()).filter(Boolean))];
    const neu = {
      gewerke: listen.gewerke ? sauber(listen.gewerke) : get().gewerke,
      geschosse: listen.geschosse ? sauber(listen.geschosse) : get().geschosse,
    };
    const alt = await r.holeAktiv<Einstellungen>(EINSTELLUNGEN_ID);
    if (alt) await r.aendere<Einstellungen>(alt, neu);
    else await r.neu<Einstellungen>('einstellungen', null, neu, EINSTELLUNGEN_ID);
    set(neu);
  },
}));

/** Das aktuell gewählte Projekt (oder undefined). */
export function useAktivesProjekt(): Projekt | undefined {
  return useApp((s) => s.projekte.find((p) => p.id === s.aktivesProjektId));
}
