/** Browser: PDF bzw. Bild direkt im Bildschirm anzeigen (eingebauter Betrachter des Browsers, mit Zoom und Seitenwahl). */
import { createElement, useEffect, useState } from 'react';
import { bildUri } from '../foto/dateien';
import { farbe } from './theme';

export function DateiAnsicht({ datei, mime, name }: { datei: string; mime: string; name: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let aktiv = true;
    bildUri(datei).then((u) => aktiv && setUrl(u));
    return () => {
      aktiv = false;
    };
  }, [datei]);
  if (!url) return null;
  const rahmen = { width: '100%', border: `1px solid ${farbe.linie}`, borderRadius: 12, backgroundColor: '#fff' };
  if (mime === 'application/pdf') {
    return createElement('iframe', { src: url, title: name, 'data-testid': 'pdf-ansicht', style: { ...rahmen, height: '78vh' } });
  }
  return createElement('img', { src: url, alt: name, 'data-testid': 'bild-ansicht', style: { ...rahmen, objectFit: 'contain' } });
}

export const ansichtImBildschirm = true;
