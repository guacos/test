import { useEffect, useState } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import { bildUri } from '../foto/dateien';
import { farbe } from './theme';

/** Zeigt ein gespeichertes Bild anhand seines Dateischlüssels. */
export function Bild({ datei, style, vorschau }: { datei: string; style?: StyleProp<ImageStyle>; vorschau?: string }) {
  const [uri, setUri] = useState<string | null>(vorschau ?? null);
  useEffect(() => {
    let aktiv = true;
    bildUri(datei).then((u) => aktiv && u && setUri(u));
    return () => {
      aktiv = false;
    };
  }, [datei]);
  if (!uri) return <View style={[{ backgroundColor: farbe.flaeche }, style as object]} />;
  return <Image source={{ uri }} style={style} resizeMode="cover" accessibilityLabel="Foto" />;
}
