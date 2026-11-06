import Anthropic from '@anthropic-ai/sdk';
import { AUFGABEN, type Aufgabe } from './fachlich';

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

export interface KiAufruf {
  (aufgabe: Aufgabe, text: string, hatFoto: boolean): Promise<unknown>;
}

/** Ruft Claude mit festem JSON-Schema auf und prüft die Antwort. */
export function erstelleKi(client: Anthropic, modell: string): KiAufruf {
  return async (aufgabe, text, hatFoto) => {
    const a = AUFGABEN[aufgabe];
    const inhalt = hatFoto ? `${text}\n\n(Zu dieser Notiz gibt es ein Foto.)` : text;
    let antwort: Anthropic.Beta.BetaMessage;
    try {
      antwort = await client.beta.messages.create({
        model: modell,
        max_tokens: 4000,
        system: a.system,
        messages: [{ role: 'user', content: inhalt }],
        // Einfache Zuordnung: wenig Denkaufwand reicht
        output_config: { effort: 'low', format: { type: 'json_schema', schema: a.schema } },
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
    return pruefeAntwort(aufgabe, json);
  };
}

export function pruefeAntwort(aufgabe: Aufgabe, json: string): unknown {
  let roh: unknown;
  try {
    roh = JSON.parse(json);
  } catch {
    throw new KiFehler('KI-Antwort ist kein JSON', 502);
  }
  const r = AUFGABEN[aufgabe].pruefung.safeParse(roh);
  if (!r.success) throw new KiFehler('KI-Antwort passt nicht zum Schema', 502);
  return r.data;
}
