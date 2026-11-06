import { useState } from 'react';
import { View } from 'react-native';
import { LEERES_PROJEKT, projektOrdnerName, pruefeProjekt } from '../domain/projekt';
import type { ProjektDaten } from '../domain/types';
import { useApp } from '../state/useApp';
import { Feld, Knopf, SchalterZeile, Seite, Text2 } from './bausteine';

/** Formular zum Anlegen und Bearbeiten eines Projekts. */
export function ProjektFormular({
  id,
  start,
  onFertig,
  onLoeschen,
}: {
  id?: string;
  start?: ProjektDaten;
  onFertig: () => void;
  onLoeschen?: () => void;
}) {
  const projekte = useApp((s) => s.projekte);
  const speichern = useApp((s) => s.projektSpeichern);
  const [d, setD] = useState<ProjektDaten>(start ?? LEERES_PROJEKT);
  const [versucht, setVersucht] = useState(false);
  const pruefung = pruefeProjekt(d, projekte, id);
  const fehler = versucht ? pruefung.fehler : {};

  const setze = <K extends keyof ProjektDaten>(k: K, v: ProjektDaten[K]) => setD((alt) => ({ ...alt, [k]: v }));

  async function speichereJetzt() {
    setVersucht(true);
    if (!pruefung.ok) return;
    await speichern(
      { ...d, nr: d.nr.trim(), name: d.name.trim(), bauherr: d.bauherr.trim(), adresse: d.adresse.trim() },
      id,
    );
    onFertig();
  }

  return (
    <Seite>
      <Feld
        label="Projekt-Nr. *"
        value={d.nr}
        onChangeText={(v) => setze('nr', v)}
        fehler={fehler.nr}
        placeholder="z. B. 2026-014"
        autoCapitalize="characters"
        testID="feld-nr"
      />
      <Feld
        label="Projektname *"
        value={d.name}
        onChangeText={(v) => setze('name', v)}
        fehler={fehler.name}
        placeholder="z. B. Neubau Halle Nord"
        testID="feld-name"
      />
      <Feld label="Bauherr" value={d.bauherr} onChangeText={(v) => setze('bauherr', v)} testID="feld-bauherr" />
      <Feld
        label="Adresse"
        value={d.adresse}
        onChangeText={(v) => setze('adresse', v)}
        multiline
        testID="feld-adresse"
      />
      <SchalterZeile
        label="KI erlaubt"
        wert={d.kiErlaubt}
        onChange={(v) => setze('kiErlaubt', v)}
        hinweis={
          d.kiErlaubt
            ? 'AN: Kurztexte und verkleinerte Fotos (ohne Ortsdaten) werden zum Ausformulieren und Taggen an die KI geschickt. Projektname und Bauherr werden nicht übertragen.'
            : 'AUS: Nichts verlässt dein Gerät und dein OneDrive. Zuordnung per Stichwort, Tags manuell, Suche nur lokal.'
        }
      />
      {pruefung.ok ? <Text2 leise>Ordner in OneDrive: Bauleitung-App/{projektOrdnerName(d)}</Text2> : null}
      <View style={{ gap: 12, marginTop: 8 }}>
        <Knopf titel="Speichern" icon="content-save" onPress={speichereJetzt} testID="projekt-speichern" />
        <Knopf titel="Abbrechen" art="neben" onPress={onFertig} />
        {onLoeschen ? <Knopf titel="Projekt löschen" art="gefahr" icon="delete" onPress={onLoeschen} /> : null}
      </View>
    </Seite>
  );
}
