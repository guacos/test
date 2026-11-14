import { Alert, Platform } from 'react-native';

/** Sicherheitsabfrage, funktioniert auf Android und im Browser. */
export function bestaetigen(titel: string, text: string, ja = 'Löschen'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${titel}\n\n${text}`));
  }
  return new Promise((resolve) => {
    Alert.alert(titel, text, [
      { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
      { text: ja, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}
