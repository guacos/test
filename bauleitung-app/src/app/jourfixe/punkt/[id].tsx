import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import type { ProtokollPunkt } from '../../../domain/types';
import { holeRepo, useApp } from '../../../state/useApp';
import { useDatensatz } from '../../../state/useDaten';
import { Feld, Knopf, Leer, Seite, Text2 } from '../../../ui/bausteine';
import { bestaetigen } from '../../../ui/bestaetigen';

/** Jour-Fixe-Punkt bearbeiten (Verantwortlich, Frist, Status, Ergänzungen, Bilder folgen in Schritt 5). */
export default function PunktScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useDatensatz<ProtokollPunkt>(id);
  if (p === undefined) return null;
  if (!p) {
    return (
      <Seite>
        <Leer text="Punkt nicht gefunden." />
      </Seite>
    );
  }
  return <Formular key={p.id + p.version} p={p} />;
}

function Formular({ p }: { p: ProtokollPunkt }) {
  const geaendert = useApp((s) => s.geaendert);
  const [thema, setThema] = useState(p.thema);
  const [beschreibung, setBeschreibung] = useState(p.beschreibung);

  async function speichern() {
    await holeRepo().aendere<ProtokollPunkt>(p, { thema: thema.trim() || p.thema, beschreibung: beschreibung.trim() });
    geaendert();
    router.back();
  }

  async function loeschen() {
    if (!(await bestaetigen('Punkt entfernen?', p.thema))) return;
    await holeRepo().loesche(p);
    geaendert();
    router.back();
  }

  return (
    <Seite>
      <Feld label="Thema" value={thema} onChangeText={setThema} testID="feld-thema" />
      <Feld label="Beschreibung" value={beschreibung} onChangeText={setBeschreibung} multiline testID="feld-beschreibung" />
      {p.ki === 'ausstehend' ? <Text2 leise>KI-Ausformulierung wird nachgeholt, sobald Netz da ist.</Text2> : null}
      <View style={{ gap: 12, marginTop: 8 }}>
        <Knopf titel="Speichern" icon="content-save" onPress={speichern} testID="speichern" />
        <Knopf titel="Abbrechen" art="neben" onPress={() => router.back()} />
        <Knopf titel="Punkt entfernen" art="gefahr" icon="delete" onPress={loeschen} />
      </View>
    </Seite>
  );
}
