/** Android: erzeugte Datei anzeigen/teilen (z. B. an Outlook, Drucker, PDF-Anzeige). */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function zeigeDatei(name: string, bytes: Uint8Array, typ = 'application/pdf'): Promise<void> {
  const ordner = new Directory(Paths.cache, 'ausgabe');
  if (!ordner.exists) ordner.create({ intermediates: true, idempotent: true });
  const f = new File(ordner, name);
  if (f.exists) f.delete();
  f.create();
  await f.write(bytes);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(f.uri, { mimeType: typ, dialogTitle: name });
  }
}

/** Öffnet eine auf dem Gerät gespeicherte Datei (z. B. Plan-PDF) in der PDF-Anzeige des Handys – ohne Netz. */
export async function oeffneGespeicherteDatei(schluessel: string, name: string, typ: string): Promise<void> {
  const quelle = new File(Paths.document, 'bilder', schluessel);
  if (!quelle.exists) throw new Error('Die Datei liegt nicht auf diesem Gerät.');
  const ordner = new Directory(Paths.cache, 'ansicht');
  if (!ordner.exists) ordner.create({ intermediates: true, idempotent: true });
  const ziel = new File(ordner, name.replace(/[\\/:*?"<>|]/g, '-'));
  if (ziel.exists) ziel.delete();
  await quelle.copy(ziel);
  if (await File.canPreview(ziel, { mimeType: typ })) {
    await File.preview(ziel, { title: name, mimeType: typ });
  } else if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(ziel.uri, { mimeType: typ, dialogTitle: name });
  } else {
    throw new Error('Auf dem Handy ist keine App installiert, die diese Datei anzeigen kann.');
  }
}
