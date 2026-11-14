import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { farbe, groesse } from '../ui/theme';

/**
 * Rücksprung-Adresse der Microsoft-Anmeldung. Im Browser schließt sich dieses Fenster
 * von selbst; auf dem Handy geht es zurück zur App.
 */
export default function AuthScreen() {
  useEffect(() => {
    const t = setTimeout(() => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: farbe.hintergrund }}>
      <ActivityIndicator size="large" color={farbe.navy} />
      <Text style={{ fontSize: groesse.schrift, color: farbe.text }}>Anmeldung wird abgeschlossen …</Text>
    </View>
  );
}
