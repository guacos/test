/** Android: Anmeldedaten verschlüsselt im Schlüsselspeicher des Geräts. */
import * as SecureStore from 'expo-secure-store';

const KEY = 'ms-anmeldung';

export async function ladeAnmeldung(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function speichereAnmeldung(wert: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, wert);
}

export async function loescheAnmeldung(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
