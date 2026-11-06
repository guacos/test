import { neueId } from '../lib/id';
import { create } from 'zustand';
import { sortiereProjekte } from '../domain/projekt';
import type { Projekt, ProjektDaten } from '../domain/types';
import { Repo } from '../data/repo';
import type { RecordStore } from '../data/RecordStore';
import { erzeugeStore } from '../data/store';

const META_AKTIV = 'aktivesProjekt';
const META_AUTOR = 'autor';
const META_GERAET = 'geraet';

interface AppState {
  bereit: boolean;
  fehler: string | null;
  projekte: Projekt[];
  aktivesProjektId: string | null;
  /** Name, der als Ersteller an jedem Datensatz steht. Später: Name des Microsoft-Kontos. */
  autor: string;

  init: (store?: RecordStore) => Promise<void>;
  projektSpeichern: (daten: ProjektDaten, id?: string) => Promise<Projekt>;
  projektLoeschen: (id: string) => Promise<void>;
  projektWaehlen: (id: string) => Promise<void>;
  autorSetzen: (name: string) => Promise<void>;
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
      set({ bereit: true, projekte, aktivesProjektId: aktiv, autor });
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
}));

/** Das aktuell gewählte Projekt (oder undefined). */
export function useAktivesProjekt(): Projekt | undefined {
  return useApp((s) => s.projekte.find((p) => p.id === s.aktivesProjektId));
}
