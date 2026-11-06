import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAktivesProjekt } from '../state/useApp';
import { Knopf, Leer, Seite } from './bausteine';
import { farbe, groesse } from './theme';

/** Projekt-Umschalter oben in der Kopfzeile. */
export function ProjektKopf() {
  const p = useAktivesProjekt();
  return (
    <Pressable
      testID="projekt-umschalter"
      accessibilityRole="button"
      accessibilityLabel="Projekt wechseln"
      onPress={() => router.push('/projektwahl')}
      style={({ pressed }) => [s.kopf, pressed && { opacity: 0.7 }]}
    >
      <View style={{ flexShrink: 1 }}>
        <Text style={s.kopfKlein} numberOfLines={1}>
          {p ? `Projekt ${p.nr}` : 'Kein Projekt'}
        </Text>
        <Text style={s.kopfGross} numberOfLines={1}>
          {p ? p.name : 'Projekt anlegen'}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-down" size={30} color={farbe.weiss} />
    </Pressable>
  );
}

/** Großer Plus-Button für die Schnellerfassung, unten rechts (Daumenbereich). */
export function PlusKnopf({ unten }: { unten: number }) {
  return (
    <Pressable
      testID="plus-knopf"
      accessibilityRole="button"
      accessibilityLabel="Schnellerfassung"
      onPress={() => router.push('/erfassen')}
      style={({ pressed }) => [s.plus, { bottom: unten }, pressed && { transform: [{ scale: 0.95 }] }]}
    >
      <MaterialCommunityIcons name="plus" size={44} color={farbe.weiss} />
    </Pressable>
  );
}

/** Zeigt den Inhalt nur, wenn ein Projekt gewählt ist – sonst Aufforderung zum Anlegen. */
export function MitProjekt({ children }: { children: ReactNode }) {
  const p = useAktivesProjekt();
  if (p) return <>{children}</>;
  return (
    <Seite>
      <Leer text="Noch kein Projekt angelegt. Lege zuerst ein Projekt an.">
        <Knopf titel="Projekt anlegen" icon="plus" onPress={() => router.push('/projekte/neu')} testID="erstes-projekt" />
      </Leer>
    </Seite>
  );
}

const s = StyleSheet.create({
  kopf: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingVertical: 4, maxWidth: 520 },
  kopfKlein: { color: '#D8E1EA', fontSize: 13, fontWeight: '600' },
  kopfGross: { color: farbe.weiss, fontSize: groesse.schrift + 1, fontWeight: '800' },
  plus: {
    position: 'absolute',
    right: 20,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: farbe.akzent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: farbe.weiss,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
