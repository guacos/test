import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Foto, FotoAblage, Projekt } from '../domain/types';
import { fotoAnlegen } from '../dienste/fotos';
import { fotoAufnehmen, fotosAusGalerie, kameraVerfuegbar, type NeuesBild } from '../foto/aufnahme';
import { holeRepo, useApp } from '../state/useApp';
import { useDaten } from '../state/useDaten';
import { Knopf } from './bausteine';
import { Bild } from './Bild';
import { farbe, groesse } from './theme';
import { toast } from './toast';

/**
 * Fotos an einem Eintrag: Vorschaubilder, Aufnehmen/Auswählen, Entfernen.
 * Entfernen löst nur die Verknüpfung – das Foto bleibt in der Fotodokumentation.
 */
export function FotoLeiste({
  projekt,
  fotoIds,
  onChange,
  ablage = 'fotos',
  titel = 'Fotos',
  tags,
  gewerk,
  testID = 'fotos',
}: {
  projekt: Pick<Projekt, 'id' | 'kiErlaubt'>;
  fotoIds: string[];
  onChange: (ids: string[]) => void | Promise<void>;
  ablage?: FotoAblage;
  titel?: string;
  tags?: string[];
  gewerk?: string | null;
  testID?: string;
}) {
  const alle = useDaten<Foto>('foto', projekt.id) ?? [];
  const geaendert = useApp((s) => s.geaendert);
  const fotos = fotoIds.map((id) => alle.find((f) => f.id === id)).filter((f): f is Foto => !!f);

  async function neu(quelle: 'kamera' | 'galerie') {
    try {
      const bilder: NeuesBild[] = quelle === 'kamera' ? [await fotoAufnehmen()].filter((b): b is NeuesBild => !!b) : await fotosAusGalerie(true);
      if (!bilder.length) return;
      const ids: string[] = [];
      for (const b of bilder) ids.push((await fotoAnlegen(holeRepo(), projekt, b, { ablage, tags, gewerk })).id);
      await onChange([...fotoIds, ...ids]);
      geaendert();
      useApp.getState().nachholen().catch(() => {});
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Bild konnte nicht hinzugefügt werden', { fehler: true });
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>
        {titel} {fotos.length ? `(${fotos.length})` : ''}
      </Text>
      {fotos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4, paddingRight: 4 }}>
          {fotos.map((f) => (
            <View key={f.id}>
              <Pressable accessibilityRole="button" accessibilityLabel="Foto öffnen" onPress={() => router.push({ pathname: '/fotos/[id]', params: { id: f.id } })}>
                <Bild foto={f} style={s.bild} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Foto entfernen"
                testID={`${testID}-entfernen`}
                hitSlop={8}
                onPress={async () => {
                  await onChange(fotoIds.filter((id) => id !== f.id));
                  geaendert();
                }}
                style={s.x}
              >
                <MaterialCommunityIcons name="close" size={16} color={farbe.weiss} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {kameraVerfuegbar ? (
          <View style={{ flex: 1 }}>
            <Knopf titel="Kamera" art="leise" icon="camera" klein onPress={() => neu('kamera')} testID={`${testID}-kamera`} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Knopf titel={kameraVerfuegbar ? 'Galerie' : 'Bild auswählen'} art="leise" icon="image-multiple" klein onPress={() => neu('galerie')} testID={`${testID}-galerie`} />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: groesse.schriftKlein, fontWeight: '700', color: farbe.textLeise },
  bild: { width: 104, height: 104, borderRadius: 12, borderWidth: 1, borderColor: farbe.linieLeise },
  x: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: farbe.navy,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: farbe.weiss,
  },
});
