/**
 * Android: Bilddateien im App-Ordner (werden nicht vom System gelöscht).
 * Im Browser wird stattdessen dateien.web.ts verwendet.
 */
import { Directory, File, Paths } from 'expo-file-system';

function ordner(): Directory {
  const d = new Directory(Paths.document, 'bilder');
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  return d;
}

/** Übernimmt eine (temporäre) Bilddatei dauerhaft unter dem Namen. */
export async function speichereBild(quelleUri: string, name: string): Promise<void> {
  const ziel = new File(ordner(), name);
  if (ziel.exists) ziel.delete();
  new File(quelleUri).copy(ziel);
}

export async function bildUri(name: string): Promise<string> {
  return new File(ordner(), name).uri;
}

export async function loescheBild(name: string): Promise<void> {
  const f = new File(ordner(), name);
  if (f.exists) f.delete();
}

export async function bildBytes(name: string): Promise<Uint8Array> {
  return new File(ordner(), name).bytes();
}

/** Schreibt Bytes als Datei (z. B. aus OneDrive geladene Fotos, erzeugte PDFs). */
export async function schreibeDatei(name: string, bytes: Uint8Array, _mime?: string): Promise<void> {
  const f = new File(ordner(), name);
  if (f.exists) f.delete();
  f.create();
  await f.write(bytes);
}

export async function existiertDatei(name: string): Promise<boolean> {
  return new File(ordner(), name).exists;
}
