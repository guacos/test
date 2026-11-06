import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { kwTextAusSchluessel } from '../../domain/kw';
import type { Foto } from '../../domain/types';
import { loescheBild } from '../../foto/dateien';
import { holeRepo, useApp } from '../../state/useApp';
import { useDatensatz } from '../../state/useDaten';
import { Feld, Knopf, Leer, Seite, Text2 } from '../../ui/bausteine';
import { Bild } from '../../ui/Bild';
import { bestaetigen } from '../../ui/bestaetigen';

const QUELLE: Record<Foto['kwQuelle'], string> = {
  exif: 'aus dem Aufnahmedatum (EXIF)',
  dateiname: 'aus dem Dateinamen',
  kamera: 'Aufnahme mit der App',
  manuell: 'manuell',
  unbekannt: 'unbekannt',
};

/** Foto ansehen (Tags Gewerk, Art, Geschoss folgen in Schritt 4). */
export default function FotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const f = useDatensatz<Foto>(id);
  if (f === undefined) return null;
  if (!f) {
    return (
      <Seite>
        <Leer text="Foto nicht gefunden." />
      </Seite>
    );
  }
  return <Formular key={f.id + f.version} f={f} />;
}

function Formular({ f }: { f: Foto }) {
  const geaendert = useApp((s) => s.geaendert);
  const [notiz, setNotiz] = useState(f.notiz);

  async function speichern() {
    await holeRepo().aendere<Foto>(f, { notiz: notiz.trim() });
    geaendert();
    router.back();
  }

  async function loeschen() {
    if (!(await bestaetigen('Foto löschen?', 'Das Foto wird aus der App entfernt.'))) return;
    await holeRepo().loesche(f);
    await loescheBild(f.datei);
    geaendert();
    router.back();
  }

  return (
    <Seite>
      <Bild datei={f.datei} style={{ width: '100%', aspectRatio: f.breite / f.hoehe || 4 / 3, borderRadius: 10 }} />
      <Text2>
        {kwTextAusSchluessel(f.kw)} · {QUELLE[f.kwQuelle]}
      </Text2>
      <Feld label="Notiz" value={notiz} onChangeText={setNotiz} multiline />
      <View style={{ gap: 12, marginTop: 8 }}>
        <Knopf titel="Speichern" icon="content-save" onPress={speichern} />
        <Knopf titel="Abbrechen" art="neben" onPress={() => router.back()} />
        <Knopf titel="Foto löschen" art="gefahr" icon="delete" onPress={loeschen} />
      </View>
    </Seite>
  );
}
