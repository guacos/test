import NetInfo from '@react-native-community/netinfo';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { useApp } from '../state/useApp';
import { initSync, jetztAbgleichen, planeAbgleich } from '../sync/dienst';
import { KopfZurueck } from '../ui/Rahmen';
import { farbe, groesse } from '../ui/theme';
import { ToastAnzeige } from '../ui/toast';

// Schließt im Browser das Anmeldefenster von Microsoft ab.
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const bereit = useApp((s) => s.bereit);
  const fehler = useApp((s) => s.fehler);
  const init = useApp((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  // Abgleich: beim Start, wenn das Netz zurückkommt, wenn die App wieder geöffnet wird, und regelmäßig.
  useEffect(() => {
    if (!bereit) return;
    const nachholen = () => useApp.getState().nachholen().catch(() => {});
    initSync()
      .then(() => jetztAbgleichen())
      .catch(() => {});
    nachholen();
    const netz = NetInfo.addEventListener((s) => {
      if (s.isConnected) {
        nachholen();
        planeAbgleich(1500);
      }
    });
    const app = AppState.addEventListener('change', (zustand) => {
      if (zustand === 'active') planeAbgleich(500);
    });
    const takt = setInterval(() => planeAbgleich(0), 3 * 60 * 1000);
    return () => {
      netz();
      app.remove();
      clearInterval(takt);
    };
  }, [bereit]);

  if (!bereit) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: farbe.navy }}>
        {fehler ? (
          <Text style={{ fontSize: groesse.schrift, color: farbe.weiss, textAlign: 'center' }}>
            Lokaler Speicher konnte nicht geöffnet werden: {fehler}
          </Text>
        ) : (
          <ActivityIndicator size="large" color={farbe.weiss} />
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
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: farbe.hintergrund },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="projektwahl" options={{ title: 'Projekt wählen', presentation: 'modal', headerBackVisible: false, headerLeft: () => <KopfZurueck /> }} />
        <Stack.Screen name="erfassen" options={{ title: 'Schnellerfassung', presentation: 'modal', headerBackVisible: false, headerLeft: () => <KopfZurueck /> }} />
        <Stack.Screen name="auth" options={{ title: 'Anmeldung' }} />
      </Stack>
      <ToastAnzeige />
    </>
  );
}
