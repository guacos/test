import { router } from 'expo-router';

/**
 * Zurück zum vorherigen Bildschirm. Gibt es keinen (z. B. nach dem Neuladen der Seite
 * im Browser), geht es zur angegebenen Seite.
 */
export function zurueck(ersatz: string = '/'): void {
  if (router.canGoBack()) router.back();
  else router.replace(ersatz as never);
}
