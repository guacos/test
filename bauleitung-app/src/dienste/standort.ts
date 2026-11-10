import * as Location from 'expo-location';

/** Aktuellen Standort des Geräts holen (für das Baustellen-Wetter). */
export async function aktuellerStandort(): Promise<{ lat: number; lon: number }> {
  const recht = await Location.requestForegroundPermissionsAsync();
  if (!recht.granted) throw new Error('Kein Zugriff auf den Standort. Bitte in den Einstellungen erlauben.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: Math.round(pos.coords.latitude * 1000) / 1000, lon: Math.round(pos.coords.longitude * 1000) / 1000 };
}
