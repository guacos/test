/** Schlanker Zugriff auf Microsoft Graph (OneDrive, Outlook). */
import { GRAPH_BASIS } from './config';

export class GraphFehler extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string = '',
  ) {
    super(message);
  }
}

/** Nicht angemeldet oder Anmeldung abgelaufen. */
export class NichtAngemeldet extends Error {}

export interface GraphOptionen {
  headers?: Record<string, string>;
  /** JSON-Objekt, Text oder Bytes */
  body?: unknown;
  contentType?: string;
  timeoutMs?: number;
}

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Graph {
  constructor(
    private token: () => Promise<string | null>,
    private basis: string = GRAPH_BASIS,
  ) {}

  /** Führt eine Anfrage aus. Wiederholt bei Überlastung (429/503/504) bis zu dreimal. */
  async anfrage(methode: string, pfad: string, opt: GraphOptionen = {}): Promise<Response> {
    const token = await this.token();
    if (!token) throw new NichtAngemeldet('Nicht bei Microsoft angemeldet');
    const url = /^https?:\/\//.test(pfad) ? pfad : `${this.basis}${pfad}`;
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, ...opt.headers };
    let body: BodyInit | undefined;
    if (opt.body instanceof Uint8Array) {
      body = opt.body as unknown as BodyInit;
      headers['Content-Type'] = opt.contentType ?? 'application/octet-stream';
    } else if (typeof opt.body === 'string') {
      body = opt.body;
      headers['Content-Type'] = opt.contentType ?? 'text/plain';
    } else if (opt.body !== undefined) {
      body = JSON.stringify(opt.body);
      headers['Content-Type'] = 'application/json';
    }
    for (let versuch = 0; ; versuch++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), opt.timeoutMs ?? 60_000);
      let r: Response;
      try {
        r = await fetch(url, { method: methode, headers, body, signal: ctrl.signal });
      } catch {
        throw new GraphFehler('Keine Verbindung zu Microsoft', 0, 'netz');
      } finally {
        clearTimeout(timer);
      }
      if ((r.status === 429 || r.status === 503 || r.status === 504) && versuch < 3) {
        const sek = Number(r.headers.get('Retry-After')) || 2 ** versuch;
        await warte(Math.min(sek, 20) * 1000);
        continue;
      }
      if (r.status === 401) throw new NichtAngemeldet('Anmeldung abgelaufen');
      return r;
    }
  }

  private async fehlerAus(r: Response): Promise<GraphFehler> {
    let code = '';
    let text = `Microsoft meldet Fehler ${r.status}`;
    try {
      const j = (await r.json()) as { error?: { code?: string; message?: string } };
      code = j.error?.code ?? '';
      if (j.error?.message) text = j.error.message;
    } catch {
      /* kein JSON */
    }
    return new GraphFehler(text, r.status, code);
  }

  /** Anfrage mit JSON-Antwort; wirft GraphFehler bei Fehlerstatus. */
  async json<T>(methode: string, pfad: string, opt: GraphOptionen = {}): Promise<T> {
    const r = await this.anfrage(methode, pfad, opt);
    if (!r.ok) throw await this.fehlerAus(r);
    if (r.status === 204 || r.status === 202) return undefined as T;
    return (await r.json()) as T;
  }

  /** Wie json, liefert aber null bei 404. */
  async jsonOderNull<T>(methode: string, pfad: string, opt: GraphOptionen = {}): Promise<T | null> {
    const r = await this.anfrage(methode, pfad, opt);
    if (r.status === 404) return null;
    if (!r.ok) throw await this.fehlerAus(r);
    return (await r.json()) as T;
  }

  /** Dateiinhalt laden; null bei 404. */
  async bytes(pfad: string): Promise<Uint8Array | null> {
    const r = await this.anfrage('GET', pfad);
    if (r.status === 404) return null;
    if (!r.ok) throw await this.fehlerAus(r);
    return new Uint8Array(await r.arrayBuffer());
  }
}
