import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Anfrage, FotoAnfrage, LieferscheinAnfrage, type Aufgabe } from './fachlich';
import { KiFehler, type Ki } from './ki';

export interface Umgebung {
  /** Schlüssel, den die App mitschickt (Authorization: Bearer …) */
  APP_SCHLUESSEL: string;
  /** Erlaubte Web-Adressen der Mac-Version, Komma-getrennt */
  ERLAUBTE_URSPRUENGE?: string;
}

/** Vergleich in konstanter Zeit, damit der Schlüssel nicht über Laufzeiten erraten werden kann. */
export function gleich(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/**
 * HTTP-Schnittstelle. Es wird nichts gespeichert und nichts vom Inhalt protokolliert.
 */
export function erstelleApp(umgebung: Umgebung, ki: Ki) {
  const app = new Hono();
  const urspruenge = (umgebung.ERLAUBTE_URSPRUENGE ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.use('/v1/*', cors({ origin: urspruenge, allowMethods: ['POST'], allowHeaders: ['Authorization', 'Content-Type'] }));

  app.get('/', (c) => c.text('Bauleitung KI-Backend'));

  app.use('/v1/*', async (c, next) => {
    if (c.req.method === 'OPTIONS') return next();
    const auth = c.req.header('Authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!umgebung.APP_SCHLUESSEL || !gleich(token, umgebung.APP_SCHLUESSEL)) {
      return c.json({ fehler: 'Nicht berechtigt' }, 401);
    }
    return next();
  });

  /** Führt den KI-Aufruf aus und setzt Fehler in eine Antwort um. */
  async function antworte(aufruf: () => Promise<unknown>): Promise<Response> {
    try {
      return Response.json(await aufruf());
    } catch (e) {
      const status = e instanceof KiFehler ? e.status : 500;
      const text = e instanceof KiFehler ? e.message : 'Interner Fehler';
      return Response.json({ fehler: text }, { status });
    }
  }

  for (const aufgabe of ['erfassung', 'board', 'jourfixe'] as Aufgabe[]) {
    app.post(`/v1/${aufgabe}`, async (c) => {
      const body = Anfrage.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return c.json({ fehler: 'Ungültige Anfrage' }, 400);
      return antworte(() => ki.text(aufgabe, body.data.text, body.data.hatFoto ?? false));
    });
  }

  app.post('/v1/foto', async (c) => {
    const body = FotoAnfrage.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ fehler: 'Ungültige Anfrage' }, 400);
    return antworte(() => ki.foto(body.data.bild, body.data.gewerke));
  });

  app.post('/v1/lieferschein', async (c) => {
    const body = LieferscheinAnfrage.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ fehler: 'Ungültige Anfrage' }, 400);
    return antworte(() => ki.lieferschein(body.data.bild));
  });

  return app;
}
