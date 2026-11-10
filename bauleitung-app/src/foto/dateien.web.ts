/** Browser: Bilddateien als Blob in IndexedDB. */
import { openDB, type IDBPDatabase } from 'idb';

let db: Promise<IDBPDatabase> | null = null;
function oeffne() {
  db ??= openDB('bauleitung-dateien', 1, {
    upgrade(d) {
      d.createObjectStore('bilder');
    },
  });
  return db;
}

const urls = new Map<string, string>();

export async function speichereBild(quelleUri: string, name: string): Promise<void> {
  const blob = await (await fetch(quelleUri)).blob();
  await (await oeffne()).put('bilder', blob, name);
  const alt = urls.get(name);
  if (alt) URL.revokeObjectURL(alt);
  urls.delete(name);
}

export async function bildUri(name: string): Promise<string> {
  const vorhanden = urls.get(name);
  if (vorhanden) return vorhanden;
  const blob = (await (await oeffne()).get('bilder', name)) as Blob | undefined;
  if (!blob) return '';
  const url = URL.createObjectURL(blob);
  urls.set(name, url);
  return url;
}

export async function loescheBild(name: string): Promise<void> {
  await (await oeffne()).delete('bilder', name);
  const alt = urls.get(name);
  if (alt) URL.revokeObjectURL(alt);
  urls.delete(name);
}

export async function bildBytes(name: string): Promise<Uint8Array> {
  const blob = (await (await oeffne()).get('bilder', name)) as Blob | undefined;
  return blob ? new Uint8Array(await blob.arrayBuffer()) : new Uint8Array();
}

/** Schreibt Bytes als Datei (z. B. aus OneDrive geladene Fotos, erzeugte PDFs). */
export async function schreibeDatei(name: string, bytes: Uint8Array, mime = 'image/jpeg'): Promise<void> {
  await (await oeffne()).put('bilder', new Blob([bytes as BlobPart], { type: mime }), name);
  const alt = urls.get(name);
  if (alt) URL.revokeObjectURL(alt);
  urls.delete(name);
}

export async function existiertDatei(name: string): Promise<boolean> {
  return (await (await oeffne()).count('bilder', name)) > 0;
}
