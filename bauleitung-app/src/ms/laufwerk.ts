/**
 * Dateizugriff für den Abgleich. Die Schnittstelle "Laufwerk" hat zwei Umsetzungen:
 *  - GraphLaufwerk: OneDrive über Microsoft Graph
 *  - TestLaufwerk (in den Tests): Speicher im Arbeitsspeicher
 */
import { Graph, GraphFehler } from './graph';

/** Verweis auf einen Ordner: driveId null = eigenes OneDrive. */
export interface OrdnerRef {
  driveId: string | null;
  itemId: string;
}

export interface Eintrag {
  id: string;
  name: string;
  eTag: string;
  istOrdner: boolean;
  /** Größe in Bytes (nur Dateien) */
  groesse?: number;
  /** Verknüpfung auf einen geteilten Ordner in einem anderen OneDrive */
  remote?: OrdnerRef;
}

/** Datei existiert schon bzw. wurde inzwischen von jemand anderem geändert. */
export class LaufwerkKonflikt extends Error {}
/** Keine Schreibrechte (z. B. nur lesend geteilt). */
export class KeinSchreibrecht extends Error {}

export interface SchreibOption {
  /** Nur überschreiben, wenn die Datei noch diesen Stand hat */
  ifMatch?: string;
  /** Nur anlegen, nicht überschreiben */
  nurNeu?: boolean;
  typ?: string;
}

export interface Laufwerk {
  /** Wurzel des eigenen OneDrive */
  wurzel(): OrdnerRef;
  hole(ref: OrdnerRef, pfad: string): Promise<Eintrag | null>;
  /** Inhalt eines Ordners; null, wenn es den Ordner nicht gibt */
  liste(ref: OrdnerRef, pfad: string): Promise<Eintrag[] | null>;
  /** Ordner sicherstellen (legt fehlende Ordner an) */
  ordner(ref: OrdnerRef, pfad: string): Promise<Eintrag>;
  schreibe(ref: OrdnerRef, pfad: string, daten: Uint8Array | string, opt?: SchreibOption): Promise<Eintrag>;
  lies(ref: OrdnerRef, pfad: string): Promise<Uint8Array | null>;
  /** Umbenennen und/oder in einen anderen Ordner verschieben (Pfade relativ zu ref) */
  verschiebe(ref: OrdnerRef, vonPfad: string, nachPfad: string): Promise<Eintrag>;
  loesche(ref: OrdnerRef, pfad: string): Promise<void>;
  /** Freigabe-Link eines geteilten Ordners auflösen */
  ausFreigabeLink(url: string): Promise<{ ref: OrdnerRef; name: string }>;
}

interface DriveItem {
  id: string;
  name: string;
  eTag?: string;
  size?: number;
  folder?: object;
  remoteItem?: { id: string; folder?: object; parentReference?: { driveId?: string } };
  parentReference?: { driveId?: string };
}

const AUSWAHL = '$select=id,name,eTag,size,folder,file,remoteItem,parentReference';

function kodiere(pfad: string): string {
  return pfad
    .split('/')
    .filter(Boolean)
    .map((t) => encodeURIComponent(t))
    .join('/');
}

function zuEintrag(i: DriveItem): Eintrag {
  const remote =
    i.remoteItem?.folder && i.remoteItem.parentReference?.driveId
      ? { driveId: i.remoteItem.parentReference.driveId, itemId: i.remoteItem.id }
      : undefined;
  return { id: i.id, name: i.name, eTag: i.eTag ?? '', istOrdner: !!i.folder || !!remote, remote, groesse: i.folder ? undefined : i.size };
}

/** Freigabe-Link → Kennung für /shares/{id} (laut Microsoft: "u!" + Base64-URL des Links). */
export function freigabeKennung(url: string): string {
  const b64 =
    typeof btoa === 'function'
      ? btoa(unescape(encodeURIComponent(url)))
      : (globalThis as unknown as { Buffer: { from(s: string): { toString(e: string): string } } }).Buffer.from(url).toString('base64');
  return 'u!' + b64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
}

export class GraphLaufwerk implements Laufwerk {
  constructor(private graph: Graph) {}

  wurzel(): OrdnerRef {
    return { driveId: null, itemId: 'root' };
  }

  /** Adresse eines Elements: Ordner-Verweis + optionaler Pfad darunter. */
  private adresse(ref: OrdnerRef, pfad: string, anhang = ''): string {
    const basis = ref.driveId
      ? `/drives/${encodeURIComponent(ref.driveId)}/items/${encodeURIComponent(ref.itemId)}`
      : ref.itemId === 'root'
        ? '/me/drive/root'
        : `/me/drive/items/${encodeURIComponent(ref.itemId)}`;
    const p = kodiere(pfad);
    if (!p) return `${basis}${anhang}`;
    return `${basis}:/${p}:${anhang}`;
  }

  async hole(ref: OrdnerRef, pfad: string): Promise<Eintrag | null> {
    const i = await this.graph.jsonOderNull<DriveItem>('GET', `${this.adresse(ref, pfad)}?${AUSWAHL}`);
    return i ? zuEintrag(i) : null;
  }

  async liste(ref: OrdnerRef, pfad: string): Promise<Eintrag[] | null> {
    const alle: Eintrag[] = [];
    let url: string | undefined = `${this.adresse(ref, pfad, '/children')}?${AUSWAHL}&$top=200`;
    while (url) {
      const seite: { value: DriveItem[]; '@odata.nextLink'?: string } | null = await this.graph.jsonOderNull('GET', url);
      if (!seite) return null;
      alle.push(...seite.value.map(zuEintrag));
      url = seite['@odata.nextLink'];
    }
    return alle;
  }

  async ordner(ref: OrdnerRef, pfad: string): Promise<Eintrag> {
    const vorhanden = await this.hole(ref, pfad);
    if (vorhanden) return vorhanden;
    const teile = pfad.split('/').filter(Boolean);
    let bisher = '';
    let letzter: Eintrag | null = null;
    for (const name of teile) {
      const eltern = bisher;
      bisher = bisher ? `${bisher}/${name}` : name;
      letzter = await this.hole(ref, bisher);
      if (letzter) continue;
      try {
        const neu = await this.graph.json<DriveItem>('POST', this.adresse(ref, eltern, '/children'), {
          body: { name, folder: {}, '@microsoft.graph.conflictBehavior': 'fail' },
        });
        letzter = zuEintrag(neu);
      } catch (e) {
        if (e instanceof GraphFehler && e.status === 409) {
          // inzwischen von einem anderen Gerät angelegt
          letzter = await this.hole(ref, bisher);
          if (letzter) continue;
        }
        if (e instanceof GraphFehler && e.status === 403) throw new KeinSchreibrecht('Keine Schreibrechte');
        throw e;
      }
    }
    if (!letzter) throw new GraphFehler('Ordner konnte nicht angelegt werden', 500);
    return letzter;
  }

  async schreibe(ref: OrdnerRef, pfad: string, daten: Uint8Array | string, opt: SchreibOption = {}): Promise<Eintrag> {
    const headers: Record<string, string> = {};
    if (opt.ifMatch) headers['If-Match'] = opt.ifMatch;
    const verhalten = opt.nurNeu ? 'fail' : 'replace';
    try {
      const i = await this.graph.json<DriveItem>(
        'PUT',
        `${this.adresse(ref, pfad, '/content')}?@microsoft.graph.conflictBehavior=${verhalten}`,
        { body: daten, headers, contentType: opt.typ ?? (typeof daten === 'string' ? 'application/json' : 'application/octet-stream'), timeoutMs: 120_000 },
      );
      return zuEintrag(i);
    } catch (e) {
      if (e instanceof GraphFehler && (e.status === 412 || e.status === 409)) throw new LaufwerkKonflikt(e.message);
      if (e instanceof GraphFehler && e.status === 403) throw new KeinSchreibrecht('Keine Schreibrechte');
      throw e;
    }
  }

  lies(ref: OrdnerRef, pfad: string): Promise<Uint8Array | null> {
    return this.graph.bytes(this.adresse(ref, pfad, '/content'));
  }

  async verschiebe(ref: OrdnerRef, vonPfad: string, nachPfad: string): Promise<Eintrag> {
    const i = nachPfad.lastIndexOf('/');
    const zielOrdner = i >= 0 ? nachPfad.slice(0, i) : '';
    const name = nachPfad.slice(i + 1);
    const eltern = await this.ordner(ref, zielOrdner);
    try {
      const neu = await this.graph.json<DriveItem>('PATCH', this.adresse(ref, vonPfad), {
        body: { name, parentReference: { id: eltern.id } },
      });
      return zuEintrag(neu);
    } catch (e) {
      if (e instanceof GraphFehler && e.status === 409) throw new LaufwerkKonflikt(e.message);
      if (e instanceof GraphFehler && e.status === 403) throw new KeinSchreibrecht('Keine Schreibrechte');
      throw e;
    }
  }

  async loesche(ref: OrdnerRef, pfad: string): Promise<void> {
    const r = await this.graph.anfrage('DELETE', this.adresse(ref, pfad));
    if (r.status === 403) throw new KeinSchreibrecht('Keine Schreibrechte');
    if (!r.ok && r.status !== 404) throw new GraphFehler(`Löschen fehlgeschlagen (${r.status})`, r.status);
  }

  async ausFreigabeLink(url: string): Promise<{ ref: OrdnerRef; name: string }> {
    const i = await this.graph.jsonOderNull<DriveItem>('GET', `/shares/${freigabeKennung(url.trim())}/driveItem?${AUSWAHL}`);
    if (!i) throw new GraphFehler('Der Link wurde nicht gefunden oder du hast keinen Zugriff.', 404);
    const driveId = i.remoteItem?.parentReference?.driveId ?? i.parentReference?.driveId;
    const itemId = i.remoteItem?.id ?? i.id;
    if (!driveId || !(i.folder || i.remoteItem?.folder)) throw new GraphFehler('Der Link führt nicht zu einem Ordner.', 400);
    return { ref: { driveId, itemId }, name: i.name };
  }
}
