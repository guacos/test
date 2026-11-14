/** Einstieg für Cloudflare Workers. */
import Anthropic from '@anthropic-ai/sdk';
import { erstelleApp, type Umgebung } from './app';
import { erstelleKi } from './ki';

interface Env extends Umgebung {
  ANTHROPIC_API_KEY: string;
  /** Modellname, z. B. "claude-opus-5-5" */
  CLAUDE_MODELL?: string;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 60_000 });
    const app = erstelleApp(env, erstelleKi(client, env.CLAUDE_MODELL || 'claude-opus-5-5'));
    return app.fetch(request, env, ctx);
  },
};
