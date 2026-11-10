/**
 * Abgleich mit OneDrive.
 *
 * Grundsätze:
 *  - Jeder Datensatz ist eine eigene kleine JSON-Datei: {Projekt}/_daten/{typ}/{id}.json
 *  - Hochladen nur, wenn die Datei in OneDrive noch den zuletzt bekannten Stand hat (eTag).
 *    Hat inzwischen jemand anderes geändert, entsteht ein Konflikt, der angezeigt wird –
 *    es wird nichts still überschrieben.
 *  - Fotos und PDFs liegen lesbar in den nummerierten Ordnern (02_Fotos, 03_Protokolle …).
 */
import { fotoBasisName, fotoOrdner, mitNummer, naechsteNummer, pfadPasst } from '../domain/fotoName';
import { projektOrdnerName } from '../domain/projekt';
import { EINSTELLUNGEN_ID, PROJEKT_TYPEN, type BaseRecord, type Foto, type Projekt } from '../domain/types';
import type { Repo } from '../data/repo';
import type { RecordStore } from '../data/RecordStore';
import { APP_ORDNER } from '../ms/config';
import { GraphFehler, NichtAngemeldet } from '../ms/graph';
import { KeinSchreibrecht, LaufwerkKonflikt, type Eintrag, type Laufwerk, type OrdnerRef } from '../ms/laufwerk';

export interface SyncDateien {
  bytes(name: string): Promise<Uint8Array>;
  schreibe(name: string, bytes: Uint8Array, mime?: string): Promise<void>;
  existiert(name: string): Promise<boolean>;
  loesche(name: string): Promise<void>;
}

export interface SyncKontext {
  lw: Laufwerk;
  repo: Repo;
  dateien: SyncDateien;
}

export interface SyncErgebnis {
  hoch: number;
  runter: number;
  fotos: number;
  ablage: number;
  konflikte: number;
  fehler: string[];
}

/** Wohin ein Projekt abgeglichen wird. */
export interface Ziel extends OrdnerRef {
  name: string;
}

export interface Konflikt {
  id: string;
  /** Stand in OneDrive */
  remote: BaseRecord;
  eTag: string;
  entdeckt: string;
}

export interface AblageAuftrag {
  id: string;
  projektId: string;
  /** Pfad relativ zum Projektordner, z. B. 03_Protokolle/JF_001_2026-11-06.pdf */
  pfad: string;
  /** Schlüssel der lokalen Datei */
  datei: string;
  typ: string;
}

/** Unterordner, die in jedem Projektordner angelegt werden. */
export const PROJEKT_ORDNER = ['02_Fotos', '03_Protokolle', '04_Board', '05_Maengel', '06_Bautagebuch', '07_Lieferscheine', '_daten'];
/** Vertrauliche Unterlagen liegen getrennt, damit sie nicht mit dem Projektordner geteilt werden. */
export const KERNTEAM_ORDNER = '_Kernteam';

const M_SYNC = 'sync:';
const M_ZIEL = 'ziel:';
const M_KONFLIKT = 'konflikt:';
const M_ABLAGE = 'ablage:';
const M_ORDNER = 'ordner:';
const M_FOTO_HOCH = 'fotoHoch:';
const M_FOTO_WEG = 'fotoWeg:';

function pfadVon(rec: Pick<BaseRecord, 'typ' | 'id'>): string {
  return rec.typ === 'projekt' ? '_daten/projekt.json' : `_daten/${rec.typ}/${rec.id}.json`;
}

function alsJson(rec: BaseRecord): string {
  return JSON.stringify(rec, null, 2);
}

function gleich(a: BaseRecord, b: BaseRecord): boolean {
  return a.version === b.version && a.geaendertAm === b.geaendertAm && a.geaendertVon === b.geaendertVon;
}

function leseDatensatz(bytes: Uint8Array): BaseRecord | null {
  try {
    const r = JSON.parse(new TextDecoder().decode(bytes)) as BaseRecord;
    return r && typeof r.id === 'string' && typeof r.typ === 'string' && typeof r.version === 'number' ? r : null;
  } catch {
    return null;
  }
}

function refSchluessel(r: OrdnerRef): string {
  return `${r.driveId ?? ''}|${r.itemId}`;
}

function text(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Fehler, bei denen der ganze Abgleich abbricht (kein Netz, nicht angemeldet). */
function istAbbruch(e: unknown): boolean {
  return e instanceof NichtAngemeldet || (e instanceof GraphFehler && e.code === 'netz');
}

// ---------- Zustand im lokalen Speicher ----------

export async function ladeZiele(store: RecordStore): Promise<Map<string, Ziel>> {
  const roh = await store.metaMitPrefix(M_ZIEL);
  const m = new Map<string, Ziel>();
  for (const [k, v] of Object.entries(roh)) {
    try {
      m.set(k.slice(M_ZIEL.length), JSON.parse(v) as Ziel);
    } catch {
      /* defekter Eintrag */
    }
  }
  return m;
}

export async function ladeKonflikte(store: RecordStore): Promise<Konflikt[]> {
  const roh = await store.metaMitPrefix(M_KONFLIKT);
  return Object.values(roh)
    .map((v) => {
      try {
        return JSON.parse(v) as Konflikt;
      } catch {
        return null;
      }
    })
    .filter((k): k is Konflikt => !!k);
}

export async function ladeAblage(store: RecordStore): Promise<AblageAuftrag[]> {
  const roh = await store.metaMitPrefix(M_ABLAGE);
  return Object.values(roh).map((v) => JSON.parse(v) as AblageAuftrag);
}

/** Legt eine erzeugte Datei (z. B. PDF) zum Hochladen bereit. Gleicher Pfad ersetzt einen wartenden Auftrag. */
export async function ablegen(
  store: RecordStore,
  dateien: SyncDateien,
  auftrag: { projektId: string; pfad: string; bytes: Uint8Array; typ: string },
  neueId: () => string,
): Promise<void> {
  for (const alt of await ladeAblage(store)) {
    if (alt.projektId === auftrag.projektId && alt.pfad === auftrag.pfad) {
      await dateien.loesche(alt.datei);
      await store.loescheMeta(M_ABLAGE + alt.id);
    }
  }
  const id = neueId();
  const datei = `ablage-${id}`;
  await dateien.schreibe(datei, auftrag.bytes, auftrag.typ);
  const a: AblageAuftrag = { id, projektId: auftrag.projektId, pfad: auftrag.pfad, datei, typ: auftrag.typ };
  await store.setzeMeta(M_ABLAGE + id, JSON.stringify(a));
}

// ---------- Abgleich ----------

interface Lauf extends SyncKontext {
  store: RecordStore;
  erg: SyncErgebnis;
  /** id → zuletzt bekannter Stand in OneDrive */
  info: Map<string, string>;
  konflikte: Set<string>;
}

async function setzeInfo(l: Lauf, id: string, eTag: string) {
  l.info.set(id, eTag);
  await l.store.setzeMeta(M_SYNC + id, eTag);
}

async function merkeKonflikt(l: Lauf, id: string, remote: BaseRecord, eTag: string) {
  const k: Konflikt = { id, remote, eTag, entdeckt: new Date().toISOString() };
  await l.store.setzeMeta(M_KONFLIKT + id, JSON.stringify(k));
  l.konflikte.add(id);
}

/** Einen Stand aus OneDrive übernehmen (oder Konflikt feststellen). */
async function runter(l: Lauf, ref: OrdnerRef, pfad: string, id: string, eTag: string) {
  if (l.info.get(id) === eTag) return;
  const bytes = await l.lw.lies(ref, pfad);
  if (!bytes) return;
  const remote = leseDatensatz(bytes);
  if (!remote || remote.id !== id) return;
  const lokal = await l.store.holeStatus(id);
  if (!lokal || !lokal.dirty) {
    if (!lokal || !gleich(lokal.rec, remote)) {
      await l.store.speichere(remote, false);
      l.erg.runter++;
    }
    await setzeInfo(l, id, eTag);
    return;
  }
  if (gleich(lokal.rec, remote)) {
    // derselbe Stand liegt schon in OneDrive (z. B. Antwort beim Hochladen ging verloren)
    await l.store.alsSynctMarkieren(id, lokal.rec.version);
    await setzeInfo(l, id, eTag);
    return;
  }
  // lokal geändert UND in OneDrive geändert → Konflikt anzeigen, nichts überschreiben
  await merkeKonflikt(l, id, remote, eTag);
}

/** Einen lokal geänderten Datensatz hochladen. */
async function hoch(l: Lauf, ref: OrdnerRef, rec: BaseRecord) {
  if (l.konflikte.has(rec.id)) return;
  const pfad = pfadVon(rec);
  const bekannt = l.info.get(rec.id);
  try {
    const e = await l.lw.schreibe(ref, pfad, alsJson(rec), bekannt ? { ifMatch: bekannt } : { nurNeu: true });
    await setzeInfo(l, rec.id, e.eTag);
    await l.store.alsSynctMarkieren(rec.id, rec.version);
    l.erg.hoch++;
  } catch (e) {
    if (!(e instanceof LaufwerkKonflikt)) throw e;
    const eintrag = await l.lw.hole(ref, pfad);
    const bytes = eintrag ? await l.lw.lies(ref, pfad) : null;
    const remote = bytes ? leseDatensatz(bytes) : null;
    if (!eintrag || !remote) return; // nächster Lauf versucht es erneut
    if (gleich(rec, remote)) {
      await setzeInfo(l, rec.id, eintrag.eTag);
      await l.store.alsSynctMarkieren(rec.id, rec.version);
    } else {
      await merkeKonflikt(l, rec.id, remote, eintrag.eTag);
    }
  }
}

async function syncFotos(l: Lauf, projektId: string, ref: OrdnerRef) {
  const fotos = await l.store.alle<Foto>('foto', projektId);
  const namenCache = new Map<string, string[]>();
  const namenIn = async (ordner: string) => {
    let n = namenCache.get(ordner);
    if (!n) {
      await l.lw.ordner(ref, ordner);
      n = ((await l.lw.liste(ref, ordner)) ?? []).map((e) => e.name);
      namenCache.set(ordner, n);
    }
    return n;
  };

  for (const f of fotos) {
    if (f.geloescht) {
      if (f.oneDrivePfad && !(await l.store.holeMeta(M_FOTO_WEG + f.id))) {
        await l.lw.loesche(ref, f.oneDrivePfad);
        await l.store.setzeMeta(M_FOTO_WEG + f.id, '1');
      }
      continue;
    }
    if (!f.oneDrivePfad) {
      // Antwort ging beim letzten Mal verloren? Dann nur den Pfad nachtragen.
      const schonOben = await l.store.holeMeta(M_FOTO_HOCH + f.id);
      if (schonOben) {
        await l.repo.aendereAktuell<Foto>(f.id, () => ({ oneDrivePfad: schonOben }));
        await l.store.loescheMeta(M_FOTO_HOCH + f.id);
        continue;
      }
      if (!(await l.dateien.existiert(f.datei))) continue; // Bild liegt nicht auf diesem Gerät
      const ordner = fotoOrdner(f);
      const basis = fotoBasisName(f);
      const namen = await namenIn(ordner);
      const bytes = await l.dateien.bytes(f.datei);
      let nr = naechsteNummer(basis, namen);
      let pfad: string | null = null;
      for (let versuch = 0; versuch < 6 && !pfad; versuch++) {
        const name = mitNummer(basis, nr);
        try {
          await l.lw.schreibe(ref, `${ordner}/${name}`, bytes, { nurNeu: true, typ: 'image/jpeg' });
          pfad = `${ordner}/${name}`;
          namen.push(name);
        } catch (e) {
          if (!(e instanceof LaufwerkKonflikt)) throw e;
          nr++; // Nummer inzwischen von einem anderen Gerät vergeben
        }
      }
      if (!pfad) continue;
      await l.store.setzeMeta(M_FOTO_HOCH + f.id, pfad);
      await l.repo.aendereAktuell<Foto>(f.id, () => ({ oneDrivePfad: pfad }));
      await l.store.loescheMeta(M_FOTO_HOCH + f.id);
      l.erg.fotos++;
    } else if (!pfadPasst(f)) {
      // Tags geändert → Datei umbenennen bzw. in den passenden KW-Ordner verschieben
      const ordner = fotoOrdner(f);
      const basis = fotoBasisName(f);
      const namen = await namenIn(ordner);
      const name = mitNummer(basis, naechsteNummer(basis, namen));
      try {
        await l.lw.verschiebe(ref, f.oneDrivePfad, `${ordner}/${name}`);
        namen.push(name);
        await l.repo.aendereAktuell<Foto>(f.id, () => ({ oneDrivePfad: `${ordner}/${name}` }));
      } catch (e) {
        if (istAbbruch(e) || e instanceof KeinSchreibrecht) throw e;
        // Datei schon von einem anderen Gerät verschoben: der neue Pfad kommt mit dem nächsten Abgleich
      }
    }
  }
}

async function syncAblage(l: Lauf, projektId: string, ref: OrdnerRef) {
  for (const a of await ladeAblage(l.store)) {
    if (a.projektId !== projektId) continue;
    if (await l.dateien.existiert(a.datei)) {
      const i = a.pfad.lastIndexOf('/');
      if (i > 0) await l.lw.ordner(ref, a.pfad.slice(0, i));
      await l.lw.schreibe(ref, a.pfad, await l.dateien.bytes(a.datei), { typ: a.typ });
      await l.dateien.loesche(a.datei);
      l.erg.ablage++;
    }
    await l.store.loescheMeta(M_ABLAGE + a.id);
  }
}

async function syncProjekt(l: Lauf, projektId: string, ziel: Ziel) {
  const ref: OrdnerRef = { driveId: ziel.driveId, itemId: ziel.itemId };
  let schreibbar = true;

  if (!(await l.store.holeMeta(M_ORDNER + projektId))) {
    try {
      for (const o of PROJEKT_ORDNER) await l.lw.ordner(ref, o);
      await l.store.setzeMeta(M_ORDNER + projektId, '1');
    } catch (e) {
      if (!(e instanceof KeinSchreibrecht)) throw e;
      schreibbar = false;
    }
  }

  // 1. Herunterladen
  const pe = await l.lw.hole(ref, '_daten/projekt.json');
  if (pe) await runter(l, ref, '_daten/projekt.json', projektId, pe.eTag);
  for (const typ of PROJEKT_TYPEN) {
    const liste = await l.lw.liste(ref, `_daten/${typ}`);
    if (!liste) continue;
    for (const e of liste) {
      if (e.istOrdner || !e.name.endsWith('.json')) continue;
      await runter(l, ref, `_daten/${typ}/${e.name}`, e.name.slice(0, -5), e.eTag);
    }
  }

  // 2. Hochladen
  if (!schreibbar) return;
  try {
    await syncFotos(l, projektId, ref);
    const dirty = (await l.store.ungesynct()).filter((r) => r.projektId === projektId);
    for (const r of dirty) await hoch(l, ref, r);
    await syncAblage(l, projektId, ref);
  } catch (e) {
    if (!(e instanceof KeinSchreibrecht)) throw e;
    l.erg.fehler.push(`„${ziel.name}“: keine Schreibrechte – deine Änderungen bleiben auf diesem Gerät.`);
  }
}

async function legeProjektOrdnerAn(l: Lauf, appRef: OrdnerRef, p: Projekt, kinder: Eintrag[]): Promise<Ziel> {
  const basis = projektOrdnerName(p);
  for (let n = 1; n < 20; n++) {
    const name = n === 1 ? basis : `${basis} (${n})`;
    const vorhanden = kinder.find((k) => k.name.toLowerCase() === name.toLowerCase());
    if (vorhanden) {
      // Ordner gleichen Namens: nur verwenden, wenn er zu genau diesem Projekt gehört
      const ref = vorhanden.remote ?? { driveId: null, itemId: vorhanden.id };
      const roh = await l.lw.lies(ref, '_daten/projekt.json');
      const anderes = roh ? leseDatensatz(roh) : null;
      if (anderes && anderes.id !== p.id) continue;
      return { ...ref, name };
    }
    const neu = await l.lw.ordner(appRef, name);
    kinder.push(neu);
    await l.lw.ordner(appRef, `${KERNTEAM_ORDNER}/${name}/01_Unterlagen`);
    return { driveId: null, itemId: neu.id, name };
  }
  throw new Error('Projektordner konnte nicht angelegt werden');
}

export async function abgleichen(ctx: SyncKontext): Promise<SyncErgebnis> {
  const store = ctx.repo.store;
  const erg: SyncErgebnis = { hoch: 0, runter: 0, fotos: 0, ablage: 0, konflikte: 0, fehler: [] };
  const infoRoh = await store.metaMitPrefix(M_SYNC);
  const l: Lauf = {
    ...ctx,
    store,
    erg,
    info: new Map(Object.entries(infoRoh).map(([k, v]) => [k.slice(M_SYNC.length), v])),
    konflikte: new Set((await ladeKonflikte(store)).map((k) => k.id)),
  };

  const wurzel = ctx.lw.wurzel();
  const app = await ctx.lw.ordner(wurzel, APP_ORDNER);
  const appRef: OrdnerRef = { driveId: null, itemId: app.id };

  // Einstellungen (Gewerke-Liste usw.)
  try {
    const pfad = '_Einstellungen/einstellungen.json';
    await ctx.lw.ordner(appRef, '_Einstellungen');
    const e = await ctx.lw.hole(appRef, pfad);
    if (e) await runter(l, appRef, pfad, EINSTELLUNGEN_ID, e.eTag);
    const lokal = await store.holeStatus(EINSTELLUNGEN_ID);
    if (lokal?.dirty && !l.konflikte.has(EINSTELLUNGEN_ID)) {
      const bekannt = l.info.get(EINSTELLUNGEN_ID);
      try {
        const neu = await ctx.lw.schreibe(appRef, pfad, alsJson(lokal.rec), bekannt ? { ifMatch: bekannt } : { nurNeu: true });
        await setzeInfo(l, EINSTELLUNGEN_ID, neu.eTag);
        await store.alsSynctMarkieren(EINSTELLUNGEN_ID, lokal.rec.version);
        erg.hoch++;
      } catch (err) {
        if (!(err instanceof LaufwerkKonflikt)) throw err;
        const e2 = await ctx.lw.hole(appRef, pfad);
        const b = e2 ? await ctx.lw.lies(appRef, pfad) : null;
        const remote = b ? leseDatensatz(b) : null;
        if (e2 && remote) await merkeKonflikt(l, EINSTELLUNGEN_ID, remote, e2.eTag);
      }
    }
  } catch (e) {
    if (istAbbruch(e)) throw e;
    erg.fehler.push(`Einstellungen: ${text(e)}`);
  }

  // Projekte in OneDrive entdecken (eigene Ordner und Verknüpfungen auf geteilte Ordner)
  const ziele = await ladeZiele(store);
  const kinder = (await ctx.lw.liste(appRef, '')) ?? [];
  const verknuepfungen = ((await ctx.lw.liste(wurzel, '')) ?? []).filter((k) => k.remote);
  const bekannt = new Set([...ziele.values()].map(refSchluessel));
  for (const k of [...kinder, ...verknuepfungen]) {
    if (!k.istOrdner || k.name.startsWith('_')) continue;
    const ref = k.remote ?? { driveId: null, itemId: k.id };
    if (bekannt.has(refSchluessel(ref))) continue;
    try {
      const roh = await ctx.lw.lies(ref, '_daten/projekt.json');
      const p = roh ? leseDatensatz(roh) : null;
      if (!p || p.typ !== 'projekt' || ziele.has(p.id)) continue;
      const ziel: Ziel = { ...ref, name: k.name };
      ziele.set(p.id, ziel);
      bekannt.add(refSchluessel(ref));
      await store.setzeMeta(M_ZIEL + p.id, JSON.stringify(ziel));
    } catch (e) {
      if (istAbbruch(e)) throw e;
    }
  }

  // Lokale Projekte, die noch keinen Ordner haben
  const projekte = await store.alle<Projekt>('projekt');
  for (const p of projekte) {
    if (ziele.has(p.id) || p.geloescht) continue;
    try {
      const ziel = await legeProjektOrdnerAn(l, appRef, p, kinder);
      ziele.set(p.id, ziel);
      await store.setzeMeta(M_ZIEL + p.id, JSON.stringify(ziel));
    } catch (e) {
      if (istAbbruch(e)) throw e;
      erg.fehler.push(`„${p.name}“: ${text(e)}`);
    }
  }

  for (const [projektId, ziel] of ziele) {
    try {
      await syncProjekt(l, projektId, ziel);
    } catch (e) {
      if (istAbbruch(e)) throw e;
      erg.fehler.push(`„${ziel.name}“: ${text(e)}`);
    }
  }

  // Ordner umbenennen, wenn Projekt-Nr. oder Name geändert wurden (nur im eigenen OneDrive)
  for (const p of await store.alle<Projekt>('projekt')) {
    const ziel = ziele.get(p.id);
    if (!ziel || ziel.driveId !== null || p.geloescht) continue;
    const soll = projektOrdnerName(p);
    const ist = kinder.find((k) => k.id === ziel.itemId);
    if (!ist || ist.name === soll || ist.name.startsWith(`${soll} (`)) continue;
    if (kinder.some((k) => k.name.toLowerCase() === soll.toLowerCase())) continue;
    try {
      await ctx.lw.verschiebe(appRef, ist.name, soll);
      if (await ctx.lw.hole(appRef, `${KERNTEAM_ORDNER}/${ist.name}`)) {
        await ctx.lw.verschiebe(appRef, `${KERNTEAM_ORDNER}/${ist.name}`, `${KERNTEAM_ORDNER}/${soll}`);
      }
      ist.name = soll;
      await store.setzeMeta(M_ZIEL + p.id, JSON.stringify({ ...ziel, name: soll }));
    } catch (e) {
      if (istAbbruch(e)) throw e;
    }
  }

  erg.konflikte = l.konflikte.size;
  return erg;
}

// ---------- Konflikte lösen ----------

/**
 *  meine  → meine Version gilt (wird beim nächsten Abgleich hochgeladen)
 *  andere → die Version aus OneDrive gilt
 *  beide  → die Version aus OneDrive gilt, meine wird als Kopie behalten
 */
export async function loeseKonflikt(
  store: RecordStore,
  id: string,
  wahl: 'meine' | 'andere' | 'beide',
  neueId: () => string,
): Promise<void> {
  const roh = await store.holeMeta(M_KONFLIKT + id);
  if (!roh) return;
  const k = JSON.parse(roh) as Konflikt;
  const lokal = await store.holeStatus(id);
  if (wahl === 'meine' && lokal) {
    const version = Math.max(lokal.rec.version, k.remote.version) + 1;
    await store.speichere({ ...lokal.rec, version, geaendertAm: new Date().toISOString() }, true);
    await store.setzeMeta(M_SYNC + id, k.eTag);
  } else {
    if (wahl === 'beide' && lokal && lokal.rec.typ !== 'projekt' && lokal.rec.typ !== 'einstellungen') {
      await store.speichere({ ...lokal.rec, id: neueId(), version: 1 }, true);
    }
    await store.speichere(k.remote, false);
    await store.setzeMeta(M_SYNC + id, k.eTag);
  }
  await store.loescheMeta(M_KONFLIKT + id);
}

// ---------- Team: geteiltes Projekt hinzufügen ----------

export async function projektBeitreten(ctx: SyncKontext, link: string): Promise<Projekt> {
  const { ref, name } = await ctx.lw.ausFreigabeLink(link);
  const roh = await ctx.lw.lies(ref, '_daten/projekt.json');
  const p = roh ? leseDatensatz(roh) : null;
  if (!p || p.typ !== 'projekt') {
    throw new Error('Dieser Link führt nicht zu einem Projektordner der Bauleitung-App (oder dir fehlt der Zugriff auf „_daten“).');
  }
  const store = ctx.repo.store;
  await store.setzeMeta(M_ZIEL + p.id, JSON.stringify({ ...ref, name } satisfies Ziel));
  if (!(await store.holeStatus(p.id))) await store.speichere(p, false);
  return p as Projekt;
}

// ---------- Fotos bei Bedarf aus OneDrive laden ----------

export async function ladeFotoDatei(ctx: SyncKontext, foto: Pick<Foto, 'projektId' | 'oneDrivePfad' | 'datei'>): Promise<boolean> {
  if (!foto.projektId || !foto.oneDrivePfad) return false;
  const roh = await ctx.repo.store.holeMeta(M_ZIEL + foto.projektId);
  if (!roh) return false;
  const ziel = JSON.parse(roh) as Ziel;
  const bytes = await ctx.lw.lies({ driveId: ziel.driveId, itemId: ziel.itemId }, foto.oneDrivePfad);
  if (!bytes) return false;
  await ctx.dateien.schreibe(foto.datei, bytes, 'image/jpeg');
  return true;
}
