import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { kwTextAusSchluessel } from '../../domain/kw';
import type { Foto } from '../../domain/types';
import { useAktivesProjekt } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Leer, Seite, Text2, Ueberschrift } from '../../ui/bausteine';
import { Bild } from '../../ui/Bild';
import { MitProjekt } from '../../ui/Rahmen';
import { farbe } from '../../ui/theme';

export default function FotosScreen() {
  return (
    <MitProjekt>
      <Raster />
    </MitProjekt>
  );
}

/** Vorläufige Ansicht – Galerie-Import, Tags und Filter folgen in Schritt 4. */
function Raster() {
  const projekt = useAktivesProjekt()!;
  const fotos = useDaten<Foto>('foto', projekt.id);
  if (!fotos) return null;
  const sortiert = [...fotos].sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm));
  return (
    <Seite>
      <Ueberschrift>Fotodokumentation</Ueberschrift>
      {sortiert.length === 0 ? <Leer text="Noch keine Fotos. Über den Plus-Knopf kannst du ein Foto aufnehmen." /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {sortiert.map((f) => (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/fotos/[id]', params: { id: f.id } })}
            style={{ width: 160, gap: 4 }}
          >
            <Bild datei={f.datei} style={{ width: 160, height: 120, borderRadius: 8 }} />
            <Text style={{ fontWeight: '700', color: farbe.text }}>{kwTextAusSchluessel(f.kw)}</Text>
          </Pressable>
        ))}
      </View>
      <Text2 leise>Galerie-Import, Tags (Gewerk, Art, Geschoss) und Filter folgen in Schritt 4.</Text2>
    </Seite>
  );
}
