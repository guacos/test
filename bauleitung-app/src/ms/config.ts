/**
 * Einstellungen für Microsoft (OneDrive, Outlook).
 * Die Anwendungs-ID stammt aus deiner App-Registrierung bei Microsoft (siehe README).
 * Sie ist kein Geheimnis und kann auch in der App unter „Mehr → Microsoft-Konto" eingetragen werden.
 */
export const GRAPH_BASIS = process.env.EXPO_PUBLIC_GRAPH_URL || 'https://graph.microsoft.com/v1.0';

/** Nur für automatische Tests: fester Zugangsschlüssel statt Microsoft-Anmeldung. */
export const TEST_TOKEN = process.env.EXPO_PUBLIC_TEST_TOKEN || '';

export const STANDARD_CLIENT_ID = process.env.EXPO_PUBLIC_MS_CLIENT_ID || '';

/** "common" = private Microsoft-Konten und Firmenkonten */
const AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';

export const DISCOVERY = {
  authorizationEndpoint: `${AUTHORITY}/authorize`,
  tokenEndpoint: `${AUTHORITY}/token`,
};

/** OneDrive: Dateien lesen/schreiben (auch geteilte Ordner), Name des Kontos, dauerhafte Anmeldung. */
export const SCOPES_BASIS = ['openid', 'profile', 'offline_access', 'User.Read', 'Files.ReadWrite.All'];

/** Outlook: Protokoll per E-Mail senden, Termin in den Kalender eintragen (nur wenn eingeschaltet). */
export const SCOPES_OUTLOOK = ['Mail.Send', 'Calendars.ReadWrite'];

/** Oberster Ordner in OneDrive */
export const APP_ORDNER = 'Bauleitung-App';
