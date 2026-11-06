import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useApp } from '../state/useApp';
import { farbe, groesse } from '../ui/theme';

export default function RootLayout() {
  const bereit = useApp((s) => s.bereit);
  const fehler = useApp((s) => s.fehler);
  const init = useApp((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  // Sobald Netz da ist: ausstehende KI-Ausformulierungen nachholen
  useEffect(() => {
    if (!bereit) return;
    const nachholen = () => useApp.getState().nachholen().catch(() => {});
    nachholen();
    return NetInfo.addEventListener((s) => {
      if (s.isConnected) nachholen();
    });
  }, [bereit]);

  if (!bereit) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: farbe.hintergrund }}>
        {fehler ? (
          <Text style={{ fontSize: groesse.schrift, color: farbe.rot, textAlign: 'center' }}>
            Lokaler Speicher konnte nicht geöffnet werden: {fehler}
          </Text>
        ) : (
          <ActivityIndicator size="large" color={farbe.navy} />
        )}
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: farbe.navy },
          headerTintColor: farbe.weiss,
          headerTitleStyle: { fontWeight: '800', fontSize: groesse.schrift + 1 },
          contentStyle: { backgroundColor: farbe.hintergrund },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="projektwahl" options={{ title: 'Projekt wählen', presentation: 'modal' }} />
        <Stack.Screen name="erfassen" options={{ title: 'Schnellerfassung', presentation: 'modal' }} />
        <Stack.Screen name="projekte/index" options={{ title: 'Projekte' }} />
        <Stack.Screen name="projekte/neu" options={{ title: 'Neues Projekt' }} />
        <Stack.Screen name="projekte/[id]" options={{ title: 'Projekt bearbeiten' }} />
        <Stack.Screen name="board/[id]" options={{ title: 'Eintrag bearbeiten' }} />
        <Stack.Screen name="jourfixe/punkt/[id]" options={{ title: 'Punkt bearbeiten' }} />
        <Stack.Screen name="fotos/[id]" options={{ title: 'Foto' }} />
      </Stack>
    </>
  );
}
