/** Browser: erzeugte Datei herunterladen und in einem neuen Tab öffnen. */
export async function zeigeDatei(name: string, bytes: Uint8Array, typ = 'application/pdf'): Promise<void> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: typ }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Browser: gespeicherte Datei in einem neuen Tab öffnen (die Anzeige im Bildschirm selbst übernimmt der eingebaute Betrachter). */
export async function oeffneGespeicherteDatei(schluessel: string, _name: string, _typ: string): Promise<void> {
  const { bildUri } = await import('../foto/dateien');
  const url = await bildUri(schluessel);
  if (!url) throw new Error('Die Datei liegt nicht auf diesem Gerät.');
  window.open(url, '_blank', 'noopener');
}
