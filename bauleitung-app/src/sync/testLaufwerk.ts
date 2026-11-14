/**
 * OneDrive im Arbeitsspeicher – nur für Tests. Bildet das Verhalten nach, auf das sich
 * der Abgleich verlässt: eTags, "nur neu anlegen", "nur überschreiben, wenn unverändert",
 * mehrere Laufwerke (eigenes + geteiltes), Verknüpfungen, Schreibschutz.
 */
import { KeinSchreibrecht, LaufwerkKonflikt, type Eintrag, type Laufwerk, type OrdnerRef, type SchreibOption } from '../ms/laufwerk';

interface Knoten {
  id: string;
  name: string;
  eTag: string;
  daten: Uint8Array | null; // null = Ordner
  kinder: Map<string, Knoten>;
  eltern: Knoten | null;
  remote?: OrdnerRef;
}

/** Gemeinsamer "Server": mehrere Laufwerke (je Konto eins). */
export class TestWolke {
  private nr = 0;
  laufwerke = new Map<string, Knoten>();
  proId = new Map<string, Knoten>();
  /** Freigabe-Links → Ordner */
  links = new Map<string, OrdnerRef>();
  /** driveId|itemId der Ordner, die für andere nur lesbar sind */
  nurLesen = new Set<string>();
  anfragen = 0;

  neuerKnoten(name: string, daten: Uint8Array | null, eltern: Knoten | null): Knoten {
    const k: Knoten = { id: `i${++this.nr}`, name, eTag: `"e${this.nr}"`, daten, kinder: new Map(), eltern };
    this.proId.set(k.id, k);
    return k;
  }

  wurzel(driveId: string): Knoten {
    let w = this.laufwerke.get(driveId);
    if (!w) {
      w = this.neuerKnoten('root', null, null);
      this.laufwerke.set(driveId, w);
    }
    return w;
  }

  neuesETag(k: Knoten) {
    k.eTag = `"e${++this.nr}"`;
  }

  /** Ordner freigeben; liefert den Freigabe-Link. */
  teile(driveId: string, pfad: string, opt: { nurLesen?: boolean } = {}): string {
    let k = this.wurzel(driveId);
    for (const t of pfad.split('/').filter(Boolean)) k = k.kinder.get(t.toLowerCase())!;
    const link = `https://1drv.ms/f/${k.id}`;
    this.links.set(link, { driveId, itemId: k.id });
    if (opt.nurLesen) this.nurLesen.add(`${driveId}|${k.id}`);
    return link;
  }

  laufwerk(driveId: string): TestLaufwerk {
    return new TestLaufwerk(this, driveId);
  }
}

export class TestLaufwerk implements Laufwerk {
  /** true = jede Anfrage schlägt fehl (kein Netz) */
  offline = false;

  constructor(
    private wolke: TestWolke,
    private eigen: string,
  ) {}

  wurzel(): OrdnerRef {
    return { driveId: null, itemId: 'root' };
  }

  private start(ref: OrdnerRef): { knoten: Knoten; fremd: boolean; nurLesen: boolean } {
    this.wolke.anfragen++;
    if (this.offline) throw Object.assign(new Error('Keine Verbindung'), { code: 'netz' });
    const driveId = ref.driveId ?? this.eigen;
    const knoten = ref.itemId === 'root' ? this.wolke.wurzel(driveId) : this.wolke.proId.get(ref.itemId);
    if (!knoten) throw new Error(`Ordner ${ref.itemId} nicht gefunden`);
    const fremd = driveId !== this.eigen;
    return { knoten, fremd, nurLesen: fremd && this.wolke.nurLesen.has(`${driveId}|${ref.itemId}`) };
  }

  private finde(start: Knoten, pfad: string): Knoten | null {
    let k: Knoten | undefined = start;
    for (const t of pfad.split('/').filter(Boolean)) {
      k = k.kinder.get(t.toLowerCase());
      if (!k) return null;
    }
    return k;
  }

  private eintrag(k: Knoten): Eintrag {
    return { id: k.id, name: k.name, eTag: k.eTag, istOrdner: k.daten === null, remote: k.remote, groesse: k.daten?.length };
  }

  async hole(ref: OrdnerRef, pfad: string) {
    const k = this.finde(this.start(ref).knoten, pfad);
    return k ? this.eintrag(k) : null;
  }

  async liste(ref: OrdnerRef, pfad: string) {
    const k = this.finde(this.start(ref).knoten, pfad);
    if (!k || k.daten !== null) return null;
    return [...k.kinder.values()].map((x) => this.eintrag(x));
  }

  async ordner(ref: OrdnerRef, pfad: string) {
    const s = this.start(ref);
    let k = s.knoten;
    for (const t of pfad.split('/').filter(Boolean)) {
      let n = k.kinder.get(t.toLowerCase());
      if (!n) {
        if (s.nurLesen) throw new KeinSchreibrecht('Keine Schreibrechte');
        n = this.wolke.neuerKnoten(t, null, k);
        k.kinder.set(t.toLowerCase(), n);
      }
      k = n;
    }
    return this.eintrag(k);
  }

  async schreibe(ref: OrdnerRef, pfad: string, daten: Uint8Array | string, opt: SchreibOption = {}) {
    const s = this.start(ref);
    if (s.nurLesen) throw new KeinSchreibrecht('Keine Schreibrechte');
    const teile = pfad.split('/').filter(Boolean);
    const name = teile.pop()!;
    let eltern = s.knoten;
    for (const t of teile) {
      let n = eltern.kinder.get(t.toLowerCase());
      if (!n) {
        n = this.wolke.neuerKnoten(t, null, eltern);
        eltern.kinder.set(t.toLowerCase(), n);
      }
      eltern = n;
    }
    const bytes = typeof daten === 'string' ? new TextEncoder().encode(daten) : daten;
    const vorhanden = eltern.kinder.get(name.toLowerCase());
    if (vorhanden) {
      if (opt.nurNeu) throw new LaufwerkKonflikt('Datei existiert bereits');
      if (opt.ifMatch && opt.ifMatch !== vorhanden.eTag) throw new LaufwerkKonflikt('Datei wurde inzwischen geändert');
      vorhanden.daten = bytes;
      this.wolke.neuesETag(vorhanden);
      return this.eintrag(vorhanden);
    }
    if (opt.ifMatch) throw new LaufwerkKonflikt('Datei existiert nicht mehr');
    const neu = this.wolke.neuerKnoten(name, bytes, eltern);
    eltern.kinder.set(name.toLowerCase(), neu);
    return this.eintrag(neu);
  }

  async lies(ref: OrdnerRef, pfad: string) {
    const k = this.finde(this.start(ref).knoten, pfad);
    return k?.daten ?? null;
  }

  async verschiebe(ref: OrdnerRef, vonPfad: string, nachPfad: string) {
    const s = this.start(ref);
    if (s.nurLesen) throw new KeinSchreibrecht('Keine Schreibrechte');
    const k = this.finde(s.knoten, vonPfad);
    if (!k || !k.eltern) throw new Error('Datei nicht gefunden');
    const i = nachPfad.lastIndexOf('/');
    const zielOrdner = await this.ordner(ref, i >= 0 ? nachPfad.slice(0, i) : '');
    const ziel = this.wolke.proId.get(zielOrdner.id)!;
    const name = nachPfad.slice(i + 1);
    if (ziel.kinder.has(name.toLowerCase())) throw new LaufwerkKonflikt('Name schon vergeben');
    k.eltern.kinder.delete(k.name.toLowerCase());
    k.name = name;
    k.eltern = ziel;
    ziel.kinder.set(name.toLowerCase(), k);
    this.wolke.neuesETag(k);
    return this.eintrag(k);
  }

  async loesche(ref: OrdnerRef, pfad: string) {
    const s = this.start(ref);
    if (s.nurLesen) throw new KeinSchreibrecht('Keine Schreibrechte');
    const k = this.finde(s.knoten, pfad);
    if (k?.eltern) k.eltern.kinder.delete(k.name.toLowerCase());
  }

  async ausFreigabeLink(url: string) {
    this.wolke.anfragen++;
    const ref = this.wolke.links.get(url.trim());
    if (!ref) throw new Error('Der Link wurde nicht gefunden oder du hast keinen Zugriff.');
    return { ref, name: this.wolke.proId.get(ref.itemId)!.name };
  }

  /** Verknüpfung auf einen geteilten Ordner in "Meine Dateien" legen (wie in OneDrive). */
  verknuepfe(link: string, name: string) {
    const ref = this.wolke.links.get(link)!;
    const w = this.wolke.wurzel(this.eigen);
    const k = this.wolke.neuerKnoten(name, null, w);
    k.remote = ref;
    w.kinder.set(name.toLowerCase(), k);
  }

  /** Alle Dateipfade (für Prüfungen in Tests). */
  pfade(): string[] {
    const r: string[] = [];
    const lauf = (k: Knoten, p: string) => {
      for (const kind of k.kinder.values()) {
        const pfad = p ? `${p}/${kind.name}` : kind.name;
        if (kind.daten === null) lauf(kind, pfad);
        else r.push(pfad);
      }
    };
    lauf(this.wolke.wurzel(this.eigen), '');
    return r.sort();
  }

  ordnerPfade(): string[] {
    const r: string[] = [];
    const lauf = (k: Knoten, p: string) => {
      for (const kind of k.kinder.values()) {
        if (kind.daten !== null) continue;
        const pfad = p ? `${p}/${kind.name}` : kind.name;
        r.push(pfad);
        lauf(kind, pfad);
      }
    };
    lauf(this.wolke.wurzel(this.eigen), '');
    return r.sort();
  }

  text(pfad: string): string | null {
    const k = this.finde(this.wolke.wurzel(this.eigen), pfad);
    return k?.daten ? new TextDecoder().decode(k.daten) : null;
  }
}

/** Dateispeicher im Arbeitsspeicher. */
export class TestDateien {
  daten = new Map<string, Uint8Array>();
  async bytes(name: string) {
    const b = this.daten.get(name);
    if (!b) throw new Error('Datei fehlt');
    return b;
  }
  async schreibe(name: string, bytes: Uint8Array) {
    this.daten.set(name, bytes);
  }
  async existiert(name: string) {
    return this.daten.has(name);
  }
  async loesche(name: string) {
    this.daten.delete(name);
  }
}
