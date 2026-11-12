/** Android: Bilder werden direkt gezeigt; PDFs öffnet die PDF-Anzeige des Handys (Knopf „Öffnen“). */
import { Bild } from './Bild';

export function DateiAnsicht({ datei, mime }: { datei: string; mime: string; name: string }) {
  if (mime.startsWith('image/')) return <Bild datei={datei} einpassen style={{ width: '100%', height: 420, borderRadius: 12 }} />;
  return null;
}

export const ansichtImBildschirm = false;
