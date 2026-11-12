import Anthropic from '@anthropic-ai/sdk';
import {
  AUFGABEN,
  FRAGE_SYSTEM,
  fotoPruefung,
  fotoSchema,
  fotoSystem,
  LIEFERSCHEIN,
  pruefeFrageAntwort,
  type Aufgabe,
  type FrageAntwort,
  type Quelle,
} from './fachlich';

/** Modelle, bei denen die serverseitige Ausweichlösung bei Ablehnung ("fallbacks") verfügbar ist. */
const MIT_FALLBACK = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

export class KiFehler extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Die Aufgaben, die das Backend für die App erledigt. */
export interface Ki {
  text(aufgabe: Aufgabe, text: string, hatFoto: boolean): Promise<unknown>;
  foto(bild: string, gewerke: string[]): Promise<unknown>;
  lieferschein(bild: string): Promise<unknown>;
  frage(frage: string, dokumente: { name: string; pdf: string }[]): Promise<FrageAntwort>;
}

type Inhalt = string | Anthropic.Beta.BetaContentBlockParam[];

interface Pruefung {
  safeParse(wert: unknown): { success: true; data: unknown } | { success: false };
}

export function pruefe(pruefung: Pruefung, json: string): unknown {
  let roh: unknown;
  try {
    roh = JSON.parse(json);
  } catch {
    throw new KiFehler('KI-Antwort ist kein JSON', 502);
  }
  const r = pruefung.safeParse(roh);
  if (!r.success) throw new KiFehler('KI-Antwort passt nicht zum Schema', 502);
  return r.data;
}

export function pruefeAntwort(aufgabe: Aufgabe, json: string): unknown {
  return pruefe(AUFGABEN[aufgabe].pruefung, json);
}

/** Ruft Claude mit festem JSON-Schema auf und prüft die Antwort. */
export function erstelleKi(client: Anthropic, modell: string): Ki {
  async function frage(
    system: string,
    schema: Record<string, unknown>,
    inhalt: Inhalt,
    pruefung: Pruefung,
  ): Promise<unknown> {
    let antwort: Anthropic.Beta.BetaMessage;
    try {
      antwort = await client.beta.messages.create({
        model: modell,
        max_tokens: 4000,
        system,
        messages: [{ role: 'user', content: inhalt }],
        // Einfache Zuordnung: wenig Denkaufwand reicht
        output_config: { effort: 'low', format: { type: 'json_schema', schema } },
        ...(MIT_FALLBACK.has(modell) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) throw new KiFehler('KI ausgelastet', 503);
      if (e instanceof Anthropic.AuthenticationError) throw new KiFehler('KI-Schlüssel ungültig', 500);
      if (e instanceof Anthropic.BadRequestError) throw new KiFehler('KI-Anfrage ungültig', 500);
      if (e instanceof Anthropic.APIError) throw new KiFehler('KI nicht erreichbar', 502);
      throw new KiFehler('KI nicht erreichbar', 502);
    }
    if (antwort.stop_reason === 'refusal') throw new KiFehler('KI hat die Anfrage abgelehnt', 422);
    if (antwort.stop_reason === 'max_tokens') throw new KiFehler('KI-Antwort unvollständig', 502);
    const json = antwort.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return pruefe(pruefung, json);
  }

  const mitBild = (bild: string, text: string): Inhalt => [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: bild } },
    { type: 'text', text },
  ];

  return {
    text(aufgabe, text, hatFoto) {
      const a = AUFGABEN[aufgabe];
      return frage(a.system, a.schema, hatFoto ? `${text}\n\n(Zu dieser Notiz gibt es ein Foto.)` : text, a.pruefung);
    },
    foto(bild, gewerke) {
      return frage(fotoSystem(gewerke), fotoSchema(gewerke), mitBild(bild, 'Tagge dieses Baustellenfoto.'), fotoPruefung(gewerke));
    },
    lieferschein(bild) {
      return frage(LIEFERSCHEIN.system, LIEFERSCHEIN.schema, mitBild(bild, 'Lies diesen Lieferschein.'), LIEFERSCHEIN.pruefung);
    },
    async frage(text, dokumente) {
      // Die PDFs werden mit eingeschalteten Fundstellen übergeben: Claude belegt Aussagen mit Dokument und Seite.
      const inhalt: Anthropic.Beta.BetaContentBlockParam[] = dokumente.map((d, i) => ({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: d.pdf },
        title: d.name,
        citations: { enabled: true },
        // Folgefragen zu denselben Unterlagen werden günstiger und schneller
        ...(i === dokumente.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
      }));
      inhalt.push({ type: 'text', text });
      let antwort: Anthropic.Beta.BetaMessage;
      try {
        antwort = await client.beta.messages.create(
          {
            model: modell,
            max_tokens: 8000,
            system: FRAGE_SYSTEM,
            messages: [{ role: 'user', content: inhalt }],
            output_config: { effort: 'medium' },
            ...(MIT_FALLBACK.has(modell) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
          },
          { timeout: 240_000 },
        );
      } catch (e) {
        if (e instanceof Anthropic.RateLimitError) throw new KiFehler('KI ausgelastet', 503);
        if (e instanceof Anthropic.AuthenticationError) throw new KiFehler('KI-Schlüssel ungültig', 500);
        if (e instanceof Anthropic.BadRequestError) throw new KiFehler('Die Unterlagen konnten nicht gelesen werden (zu groß oder kein gültiges PDF).', 413);
        throw new KiFehler('KI nicht erreichbar', 502);
      }
      if (antwort.stop_reason === 'refusal') throw new KiFehler('KI hat die Anfrage abgelehnt', 422);
      return leseFrageAntwort(antwort.content, dokumente.map((d) => d.name));
    },
  };
}

/** Setzt Text und Fundstellen aus der Antwort zusammen. */
export function leseFrageAntwort(bloecke: Anthropic.Beta.BetaContentBlock[], namen: string[]): FrageAntwort {
  let text = '';
  const quellen: Quelle[] = [];
  for (const b of bloecke) {
    if (b.type !== 'text') continue;
    text += b.text;
    for (const c of b.citations ?? []) {
      if (c.type !== 'page_location') continue;
      quellen.push({
        dokument: c.document_title ?? namen[c.document_index] ?? `Dokument ${c.document_index + 1}`,
        seiteVon: c.start_page_number,
        // die API nennt die erste Seite NACH der Fundstelle
        seiteBis: Math.max(c.start_page_number, c.end_page_number - 1),
        zitat: c.cited_text.trim().slice(0, 400),
      });
    }
  }
  return pruefeFrageAntwort(text, quellen);
}
