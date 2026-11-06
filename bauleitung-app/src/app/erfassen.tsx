import { router } from 'expo-router';
import { Knopf, Leer, Seite } from '../ui/bausteine';

export default function ErfassenScreen() {
  return (
    <Seite>
      <Leer text="Die Schnellerfassung (Kurztext, Diktat, Foto) folgt in Schritt 2." />
      <Knopf titel="Schließen" art="neben" onPress={() => router.back()} />
    </Seite>
  );
}
