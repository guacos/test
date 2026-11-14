import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAktivesProjekt } from '../state/useApp';
import { useSync, type SyncStatus } from '../sync/dienst';
import { Knopf, Leer, Seite, type IconName } from './bausteine';
import { zurueck } from './navigation';
import { farbe, groesse, schattenStark } from './theme';

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
      <View style={s.kopfMarke}>
        <MaterialCommunityIcons name="hard-hat" size={22} color={farbe.navy} />
      </View>
      <View style={{ flexShrink: 1 }}>
        <Text style={s.kopfKlein} numberOfLines={1}>
          {p ? `Projekt ${p.nr}` : 'Kein Projekt'}
        </Text>
        <Text style={s.kopfGross} numberOfLines={1}>
          {p ? p.name : 'Projekt anlegen'}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-down" size={26} color={farbe.weiss} />
    </Pressable>
  );
}

const SYNC: Record<SyncStatus, { icon: IconName; farbe: string; text: string }> = {
  aus: { icon: 'cloud-off-outline', farbe: '#AEB9C6', text: 'Nicht mit OneDrive verbunden' },
  bereit: { icon: 'cloud-check', farbe: '#7BE096', text: 'Mit OneDrive abgeglichen' },
  laeuft: { icon: 'cloud-sync', farbe: '#FFFFFF', text: 'Abgleich läuft' },
  offline: { icon: 'cloud-off-outline', farbe: '#FFD479', text: 'Kein Netz – Abgleich folgt' },
  fehler: { icon: 'cloud-alert', farbe: '#FF9AA8', text: 'Abgleich mit Hinweisen' },
};

/** Abgleich-Anzeige in der Kopfzeile: grün = abgeglichen, gelb = wartet, rot = Konflikt/Fehler. */
export function SyncAnzeige() {
  const { status, offen, konflikte, konto } = useSync();
  let a = SYNC[status];
  if (konflikte > 0) a = { icon: 'cloud-alert', farbe: '#FF9AA8', text: `${konflikte} Konflikt(e)` };
  else if (konto && status === 'bereit' && offen > 0) a = { icon: 'cloud-upload', farbe: '#FFD479', text: `${offen} Änderung(en) warten` };
  const zahl = konflikte > 0 ? konflikte : konto && offen > 0 ? offen : 0;
  return (
    <Pressable
      testID="sync-anzeige"
      accessibilityRole="button"
      accessibilityLabel={a.text}
      onPress={() => router.push('/sync')}
      hitSlop={8}
      style={({ pressed }) => [s.sync, pressed && { opacity: 0.6 }]}
    >
      {status === 'laeuft' ? <ActivityIndicator size="small" color={farbe.weiss} /> : <MaterialCommunityIcons name={a.icon} size={26} color={a.farbe} />}
      {zahl > 0 ? (
        <View style={[s.syncZahl, { backgroundColor: konflikte > 0 ? farbe.rot : '#B26A00' }]}>
          <Text style={s.syncZahlText}>{zahl > 99 ? '99+' : zahl}</Text>
        </View>
      ) : null}
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
      style={({ pressed }) => [s.plus, { bottom: unten }, pressed && { transform: [{ scale: 0.94 }] }]}
    >
      <MaterialCommunityIcons name="plus" size={42} color={farbe.weiss} />
    </Pressable>
  );
}

/** Zeigt den Inhalt nur, wenn ein Projekt gewählt ist – sonst Aufforderung zum Anlegen. */
export function MitProjekt({ children }: { children: ReactNode }) {
  const p = useAktivesProjekt();
  if (p) return <>{children}</>;
  return (
    <Seite>
      <Leer icon="briefcase-plus-outline" text="Noch kein Projekt angelegt. Lege zuerst ein Projekt an – oder melde dich unter „Mehr“ bei Microsoft an, um vorhandene Projekte aus OneDrive zu laden.">
        <Knopf titel="Projekt anlegen" icon="plus" onPress={() => router.push('/projekte/neu')} testID="erstes-projekt" />
      </Leer>
    </Seite>
  );
}

/** Zurück-Pfeil für die Kopfzeile. Funktioniert auch nach dem Neuladen der Seite im Browser. */
export function KopfZurueck({ zu = '/' }: { zu?: string }) {
  return (
    <Pressable
      testID="kopf-zurueck"
      accessibilityRole="button"
      accessibilityLabel="Zurück"
      onPress={() => zurueck(zu)}
      hitSlop={10}
      style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 }, pressed && { opacity: 0.6 }]}
    >
      <MaterialCommunityIcons name="arrow-left" size={26} color={farbe.weiss} />
    </Pressable>
  );
}

/** Setzt den Titel der Kopfzeile eines Unterbildschirms. */
export function Titel({ text, rechts, zurueckZu = '/' }: { text: string; rechts?: ReactNode; zurueckZu?: string }) {
  return (
    <Stack.Screen
      options={{
        title: text,
        headerBackVisible: false,
        headerLeft: () => <KopfZurueck zu={zurueckZu} />,
        headerRight: rechts ? () => rechts : undefined,
      }}
    />
  );
}

const s = StyleSheet.create({
  kopf: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 4, maxWidth: 560 },
  kopfMarke: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFB98F', alignItems: 'center', justifyContent: 'center' },
  kopfKlein: { color: '#C9D5E2', fontSize: 12.5, fontWeight: '600' },
  kopfGross: { color: farbe.weiss, fontSize: groesse.schrift + 1, fontWeight: '800', letterSpacing: -0.2 },
  sync: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  syncZahl: {
    position: 'absolute',
    top: 4,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: farbe.navy,
  },
  syncZahlText: { color: farbe.weiss, fontSize: 11, fontWeight: '800' },
  plus: {
    position: 'absolute',
    right: 20,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: farbe.akzent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: farbe.weiss,
    ...schattenStark,
  },
});
