import { router } from 'expo-router';
import { useState } from 'react';
import { Feld, Knopf, Seite, Text2, Ueberschrift, Zeile } from '../../ui/bausteine';
import { useApp } from '../../state/useApp';

export default function MehrScreen() {
  const anzahl = useApp((s) => s.projekte.length);
  const autor = useApp((s) => s.autor);
  const autorSetzen = useApp((s) => s.autorSetzen);
  const [name, setName] = useState(autor);

  return (
    <Seite>
      <Zeile
        icon="briefcase"
        titel="Projekte verwalten"
        untertitel={`${anzahl} ${anzahl === 1 ? 'Projekt' : 'Projekte'}`}
        onPress={() => router.push('/projekte')}
        testID="projekte-verwalten"
      />
      <Ueberschrift>Dein Name</Ueberschrift>
      <Text2 leise>
        Steht als Ersteller an jedem Eintrag. Nach der Microsoft-Anmeldung (Schritt 6) wird der Kontoname verwendet.
      </Text2>
      <Feld label="Name" value={name} onChangeText={setName} testID="feld-autor" />
      <Knopf titel="Name speichern" art="neben" onPress={() => autorSetzen(name)} deaktiviert={!name.trim() || name.trim() === autor} />
      <Ueberschrift>OneDrive</Ueberschrift>
      <Text2 leise>Anmeldung und Abgleich folgen in Schritt 6. Bis dahin bleiben alle Daten nur auf diesem Gerät.</Text2>
    </Seite>
  );
}
