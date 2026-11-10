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
