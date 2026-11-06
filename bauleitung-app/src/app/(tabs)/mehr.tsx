import { router } from 'expo-router';
import { useState } from 'react';
import { Feld, Knopf, Seite, Text2, Ueberschrift, Zeile } from '../../ui/bausteine';
import { useApp } from '../../state/useApp';

export default function MehrScreen() {
  const anzahl = useApp((s) => s.projekte.length);
  const autor = useApp((s) => s.autor);
  const autorSetzen = useApp((s) => s.autorSetzen);
  const [name, setName] = useState(autor);
  const kiEinst = useApp((s) => s.kiEinst);
  const kiEinstSetzen = useApp((s) => s.kiEinstSetzen);
  const nachholen = useApp((s) => s.nachholen);
  const [kiUrl, setKiUrl] = useState(kiEinst?.url ?? '');
  const [kiSchluessel, setKiSchluessel] = useState(kiEinst?.schluessel ?? '');
  const [kiMeldung, setKiMeldung] = useState<string | null>(null);

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
      <Ueberschrift>KI-Backend</Ueberschrift>
      <Text2 leise>
        Wird nur in Projekten mit „KI erlaubt“ genutzt. Adresse und App-Schlüssel bekommst du beim Einrichten des
        Backends (siehe README).
      </Text2>
      <Feld label="Adresse" value={kiUrl} onChangeText={setKiUrl} autoCapitalize="none" autoCorrect={false} placeholder="https://bauleitung-ki.….workers.dev" testID="feld-ki-url" />
      <Feld label="App-Schlüssel" value={kiSchluessel} onChangeText={setKiSchluessel} autoCapitalize="none" autoCorrect={false} secureTextEntry testID="feld-ki-schluessel" />
      <Knopf
        titel="KI-Verbindung speichern"
        art="neben"
        onPress={async () => {
          await kiEinstSetzen(kiUrl.trim() ? { url: kiUrl, schluessel: kiSchluessel } : null);
          setKiMeldung('Gespeichert. Ausstehende Ausformulierungen werden nachgeholt.');
          nachholen().catch(() => setKiMeldung('Gespeichert, aber die KI ist gerade nicht erreichbar.'));
        }}
      />
      {kiMeldung ? <Text2 leise>{kiMeldung}</Text2> : null}
      <Ueberschrift>OneDrive</Ueberschrift>
      <Text2 leise>Anmeldung und Abgleich folgen in Schritt 6. Bis dahin bleiben alle Daten nur auf diesem Gerät.</Text2>
    </Seite>
  );
}
