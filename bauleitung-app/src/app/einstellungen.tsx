import { useState } from 'react';
import { STANDARD_GESCHOSSE, STANDARD_GEWERKE } from '../domain/types';
import { useApp } from '../state/useApp';
import { Abschnitt, Feld, Knopf, Reihe, Seite, Text2 } from '../ui/bausteine';
import { Titel } from '../ui/Rahmen';
import { toast } from '../ui/toast';

const zeilen = (text: string) => text.split('\n').map((z) => z.trim()).filter(Boolean);

export default function EinstellungenScreen() {
  const autor = useApp((s) => s.autor);
  const autorSetzen = useApp((s) => s.autorSetzen);
  const kiEinst = useApp((s) => s.kiEinst);
  const kiEinstSetzen = useApp((s) => s.kiEinstSetzen);
  const nachholen = useApp((s) => s.nachholen);
  const listenSpeichern = useApp((s) => s.listenSpeichern);
  const [name, setName] = useState(autor);
  const [kiUrl, setKiUrl] = useState(kiEinst?.url ?? '');
  const [kiSchluessel, setKiSchluessel] = useState(kiEinst?.schluessel ?? '');
  const [gewerke, setGewerke] = useState(useApp.getState().gewerke.join('\n'));
  const [geschosse, setGeschosse] = useState(useApp.getState().geschosse.join('\n'));

  return (
    <Seite>
      <Titel text="Einstellungen" zurueckZu="/mehr" />
      <Abschnitt titel="Dein Name">
        <Text2 leise>Steht als Ersteller an jedem Eintrag. Nach der Microsoft-Anmeldung wird der Kontoname übernommen.</Text2>
        <Feld label="Name" value={name} onChangeText={setName} testID="feld-autor" />
        <Knopf
          titel="Name speichern"
          art="neben"
          deaktiviert={!name.trim() || name.trim() === autor}
          onPress={async () => {
            await autorSetzen(name);
            toast('Name gespeichert');
          }}
          testID="autor-speichern"
        />
      </Abschnitt>

      <Abschnitt titel="Gewerke (ein Gewerk je Zeile)">
        <Feld label="Gewerke-Liste" value={gewerke} onChangeText={setGewerke} multiline style={{ minHeight: 220 }} testID="feld-gewerke" />
        <Reihe>
          <Knopf
            titel="Liste speichern"
            art="neben"
            onPress={async () => {
              const liste = zeilen(gewerke);
              if (!liste.length) return toast('Die Liste darf nicht leer sein', { fehler: true });
              await listenSpeichern({ gewerke: liste });
              toast(`${liste.length} Gewerke gespeichert`);
            }}
            testID="gewerke-speichern"
          />
          <Knopf titel="Standard" art="leise" onPress={() => setGewerke(STANDARD_GEWERKE.join('\n'))} />
        </Reihe>
        <Text2 leise>Die Liste gilt für alle Projekte und liegt in OneDrive unter Bauleitung-App/_Einstellungen.</Text2>
      </Abschnitt>

      <Abschnitt titel="Geschosse / Bereiche (je Zeile)">
        <Feld label="Geschoss-Liste" value={geschosse} onChangeText={setGeschosse} multiline style={{ minHeight: 130 }} testID="feld-geschosse" />
        <Reihe>
          <Knopf
            titel="Liste speichern"
            art="neben"
            onPress={async () => {
              const liste = zeilen(geschosse);
              if (!liste.length) return toast('Die Liste darf nicht leer sein', { fehler: true });
              await listenSpeichern({ geschosse: liste });
              toast(`${liste.length} Einträge gespeichert`);
            }}
            testID="geschosse-speichern"
          />
          <Knopf titel="Standard" art="leise" onPress={() => setGeschosse(STANDARD_GESCHOSSE.join('\n'))} />
        </Reihe>
      </Abschnitt>

      <Abschnitt titel="KI-Backend">
        <Text2 leise>
          Wird nur in Projekten mit „KI erlaubt“ genutzt. Adresse und App-Schlüssel bekommst du beim Einrichten des Backends (README, Teil D).
        </Text2>
        <Feld label="Adresse" value={kiUrl} onChangeText={setKiUrl} autoCapitalize="none" autoCorrect={false} placeholder="https://bauleitung-ki.….workers.dev" testID="feld-ki-url" />
        <Feld label="App-Schlüssel" value={kiSchluessel} onChangeText={setKiSchluessel} autoCapitalize="none" autoCorrect={false} secureTextEntry testID="feld-ki-schluessel" />
        <Knopf
          titel="KI-Verbindung speichern"
          art="neben"
          onPress={async () => {
            await kiEinstSetzen(kiUrl.trim() ? { url: kiUrl, schluessel: kiSchluessel } : null);
            toast(kiUrl.trim() ? 'Gespeichert – Ausstehendes wird nachgeholt' : 'KI-Verbindung entfernt');
            nachholen().catch(() => {});
          }}
          testID="ki-speichern"
        />
      </Abschnitt>
    </Seite>
  );
}
