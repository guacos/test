/** Browser: Anmeldedaten im Speicher des Browsers (nur für diese Web-Adresse). */
const KEY = 'bauleitung-ms-anmeldung';

export async function ladeAnmeldung(): Promise<string | null> {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function speichereAnmeldung(wert: string): Promise<void> {
  window.localStorage.setItem(KEY, wert);
}

export async function loescheAnmeldung(): Promise<void> {
  window.localStorage.removeItem(KEY);
}
