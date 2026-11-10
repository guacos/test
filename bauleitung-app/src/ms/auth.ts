/**
 * Anmeldung mit dem Microsoft-Konto (OAuth 2.0 mit PKCE, ohne Geheimnis in der App).
 * Der Zugangsschlüssel wird automatisch erneuert.
 */
import * as AuthSession from 'expo-auth-session';
import { DISCOVERY, GRAPH_BASIS, SCOPES_BASIS, SCOPES_OUTLOOK, TEST_TOKEN } from './config';
import { ladeAnmeldung, loescheAnmeldung, speichereAnmeldung } from './tokenSpeicher';

export interface Konto {
  name: string;
  email: string;
  /** Outlook-Rechte (E-Mail, Kalender) wurden erteilt */
  outlook: boolean;
}

interface Anmeldung {
  clientId: string;
  accessToken: string;
  refreshToken: string | null;
  /** Ablauf des Zugangsschlüssels (Sekunden seit 1970) */
  ablauf: number;
  konto: Konto;
}

export class AnmeldeFehler extends Error {}

let aktuell: Anmeldung | null = null;
let geladen = false;
let erneuerung: Promise<string | null> | null = null;

/** Adresse, zu der Microsoft nach der Anmeldung zurückleitet (muss in der App-Registrierung stehen). */
export function redirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: 'bauleitung', path: 'auth' });
}

async function lade(): Promise<Anmeldung | null> {
  if (geladen) return aktuell;
  geladen = true;
  if (TEST_TOKEN) {
    // Nur in Test-Builds: anderes Testkonto je Browser-Profil wählbar
    let token = TEST_TOKEN;
    try {
      token = globalThis.localStorage?.getItem('test-token') || TEST_TOKEN;
    } catch {
      /* kein localStorage */
    }
    aktuell = {
      clientId: 'test',
      accessToken: token,
      refreshToken: null,
      ablauf: Number.MAX_SAFE_INTEGER,
      konto: { name: 'Test', email: 'test@example.com', outlook: true },
    };
    try {
      const r = await fetch(`${GRAPH_BASIS}/me`, { headers: { Authorization: `Bearer ${token}` } });
      const ich = (await r.json()) as { displayName?: string; mail?: string; userPrincipalName?: string };
      aktuell.konto = { name: ich.displayName ?? 'Test', email: ich.mail ?? ich.userPrincipalName ?? '', outlook: true };
    } catch {
      /* Test-Server nicht erreichbar */
    }
    return aktuell;
  }
  const roh = await ladeAnmeldung();
  if (roh) {
    try {
      aktuell = JSON.parse(roh) as Anmeldung;
    } catch {
      aktuell = null;
    }
  }
  return aktuell;
}

async function merke(a: Anmeldung | null) {
  aktuell = a;
  geladen = true;
  if (TEST_TOKEN) return;
  if (a) await speichereAnmeldung(JSON.stringify(a));
  else await loescheAnmeldung();
}

export async function holeKonto(): Promise<Konto | null> {
  return (await lade())?.konto ?? null;
}

function ablaufAus(t: AuthSession.TokenResponse): number {
  return (t.issuedAt || Math.floor(Date.now() / 1000)) + (t.expiresIn ?? 3600);
}

/** Öffnet die Microsoft-Anmeldung. */
export async function anmelden(clientId: string, mitOutlook: boolean): Promise<Konto> {
  const id = clientId.trim();
  if (!id) throw new AnmeldeFehler('Bitte zuerst die Anwendungs-ID eintragen (siehe README, Teil E).');
  const scopes = [...SCOPES_BASIS, ...(mitOutlook ? SCOPES_OUTLOOK : [])];
  const uri = redirectUri();
  const anfrage = new AuthSession.AuthRequest({
    clientId: id,
    scopes,
    redirectUri: uri,
    usePKCE: true,
    responseType: AuthSession.ResponseType.Code,
    prompt: AuthSession.Prompt.SelectAccount,
  });
  const ergebnis = await anfrage.promptAsync(DISCOVERY);
  if (ergebnis.type === 'cancel' || ergebnis.type === 'dismiss') throw new AnmeldeFehler('Anmeldung abgebrochen.');
  if (ergebnis.type !== 'success' || !ergebnis.params.code) {
    const grund = ergebnis.type === 'error' ? (ergebnis.params.error_description ?? ergebnis.error?.message) : null;
    throw new AnmeldeFehler(`Anmeldung fehlgeschlagen${grund ? `: ${grund}` : '.'}`);
  }
  let token: AuthSession.TokenResponse;
  try {
    token = await AuthSession.exchangeCodeAsync(
      { clientId: id, code: ergebnis.params.code, redirectUri: uri, extraParams: { code_verifier: anfrage.codeVerifier ?? '' } },
      DISCOVERY,
    );
  } catch (e) {
    throw new AnmeldeFehler(`Anmeldung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
  }
  let konto: Konto = { name: '', email: '', outlook: mitOutlook };
  try {
    const r = await fetch(`${GRAPH_BASIS}/me`, { headers: { Authorization: `Bearer ${token.accessToken}` } });
    if (r.ok) {
      const ich = (await r.json()) as { displayName?: string; mail?: string; userPrincipalName?: string };
      konto = { name: ich.displayName ?? '', email: ich.mail ?? ich.userPrincipalName ?? '', outlook: mitOutlook };
    }
  } catch {
    /* Name wird später nachgeholt */
  }
  await merke({ clientId: id, accessToken: token.accessToken, refreshToken: token.refreshToken ?? null, ablauf: ablaufAus(token), konto });
  return konto;
}

export async function abmelden(): Promise<void> {
  await merke(null);
}

/** Gültigen Zugangsschlüssel holen (wird bei Bedarf erneuert). null = nicht angemeldet. */
export async function holeToken(): Promise<string | null> {
  const a = await lade();
  if (!a) return null;
  const jetzt = Math.floor(Date.now() / 1000);
  if (a.ablauf - jetzt > 120) return a.accessToken;
  if (!a.refreshToken) {
    await merke(null);
    return null;
  }
  erneuerung ??= (async () => {
    try {
      const neu = await AuthSession.refreshAsync({ clientId: a.clientId, refreshToken: a.refreshToken ?? undefined }, DISCOVERY);
      await merke({ ...a, accessToken: neu.accessToken, refreshToken: neu.refreshToken ?? a.refreshToken, ablauf: ablaufAus(neu) });
      return neu.accessToken;
    } catch (e) {
      // Erneuerung abgelehnt (z. B. nach 24 h im Browser oder Kennwort geändert) → neu anmelden.
      // Bei reinen Netzfehlern bleibt die Anmeldung erhalten.
      const text = e instanceof Error ? e.message : String(e);
      if (/invalid_grant|interaction_required|AADSTS/i.test(text)) await merke(null);
      return null;
    } finally {
      erneuerung = null;
    }
  })();
  return erneuerung;
}
