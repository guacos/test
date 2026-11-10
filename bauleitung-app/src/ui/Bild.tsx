import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import type { Foto } from '../domain/types';
import { bildUri, existiertDatei } from '../foto/dateien';
import { fotoNachladen } from '../sync/dienst';
import { farbe } from './theme';

type FotoKern = Pick<Foto, 'datei' | 'projektId' | 'oneDrivePfad'>;

/**
 * Zeigt ein gespeichertes Bild. Liegt es noch nicht auf diesem Gerät
 * (z. B. am Mac nach dem Abgleich), wird es aus OneDrive nachgeladen.
 */
export function Bild({
  datei,
  foto,
  style,
  vorschau,
  einpassen,
}: {
  datei?: string;
  foto?: FotoKern | null;
  style?: StyleProp<ImageStyle>;
  vorschau?: string;
  /** ganzes Bild zeigen statt zuschneiden */
  einpassen?: boolean;
}) {
  const name = foto?.datei ?? datei ?? '';
  const [uri, setUri] = useState<string | null>(vorschau ?? null);
  const [fehlt, setFehlt] = useState(false);
  const pfad = foto?.oneDrivePfad;

  useEffect(() => {
    let aktiv = true;
    (async () => {
      if (!name) return;
      let da = await existiertDatei(name);
      if (!da && foto) da = await fotoNachladen(foto);
      if (!aktiv) return;
      if (da) {
        const u = await bildUri(name);
        if (aktiv && u) setUri(u);
        setFehlt(false);
      } else if (!vorschau) {
        setFehlt(true);
      }
    })().catch(() => aktiv && setFehlt(true));
    return () => {
      aktiv = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, pfad]);

  if (!uri) {
    return (
      <View style={[{ backgroundColor: farbe.flaeche, alignItems: 'center', justifyContent: 'center' }, style as object]}>
        <MaterialCommunityIcons name={fehlt ? 'image-off-outline' : 'image-outline'} size={28} color="#8A94A3" />
      </View>
    );
  }
  return <Image source={{ uri }} style={style} resizeMode={einpassen ? 'contain' : 'cover'} accessibilityLabel="Foto" />;
}
