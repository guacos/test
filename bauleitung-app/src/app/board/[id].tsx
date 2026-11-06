import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ausSchluessel, kwSchluessel, kwText, plusWochen } from '../../domain/kw';
import { BEREICHE, WOCHENTAGE, type Bereich, type BoardEintrag, type Wochentag, type Woche } from '../../domain/types';
import { holeRepo, useApp } from '../../state/useApp';
import { useDatensatz } from '../../state/useDaten';
import { Chip, ChipReihe, Feld, Knopf, Leer, Seite, Text2, Ueberschrift } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';

/** Board-Eintrag bearbeiten (Checkpunkte, Prüfkette, Foto und Notiz folgen in Schritt 3). */
export default function BoardEintragScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const e = useDatensatz<BoardEintrag>(id);
  if (e === undefined) return null;
  if (!e) {
    return (
      <Seite>
        <Leer text="Eintrag nicht gefunden." />
      </Seite>
    );
  }
  return <Formular key={e.id + e.version} e={e} />;
}

function Formular({ e }: { e: BoardEintrag }) {
  const geaendert = useApp((s) => s.geaendert);
  const [titel, setTitel] = useState(e.titel);
  const [text, setText] = useState(e.text);
  const [wochentag, setWochentag] = useState<Wochentag | null>(e.wochentag);
  const [kw, setKw] = useState(e.kw);
  const [bereich, setBereich] = useState<Bereich>(e.bereich);
  const [rubrik, setRubrik] = useState(e.rubrik);

  useEffect(() => {
    if (!BEREICHE[bereich].rubriken.includes(rubrik)) setRubrik(BEREICHE[bereich].rubriken[0]);
  }, [bereich, rubrik]);

  const k = ausSchluessel(kw)!;

  async function speichern() {
    const repo = holeRepo();
    const wochen = await repo.alle<Woche>('woche', e.projektId);
    if (!wochen.some((w) => w.kw === kw)) await repo.neu<Woche>('woche', e.projektId, { kw });
    await repo.aendere<BoardEintrag>(e, { titel: titel.trim() || e.titel, text: text.trim(), wochentag, kw, bereich, rubrik });
    useApp.setState({ boardKw: kw });
    geaendert();
    router.back();
  }

  async function loeschen() {
    if (!(await bestaetigen('Eintrag löschen?', e.titel))) return;
    await holeRepo().loesche(e);
    geaendert();
    router.back();
  }

  return (
    <Seite>
      <Feld label="Titel" value={titel} onChangeText={setTitel} testID="feld-titel" />
      <Feld label="Text" value={text} onChangeText={setText} multiline testID="feld-text" />

      <Ueberschrift>Kalenderwoche</Ueberschrift>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Knopf titel="◀" art="neben" onPress={() => setKw(kwSchluessel(plusWochen(k, -1)))} />
        </View>
        <View style={{ flex: 2, alignItems: 'center' }}>
          <Text2>{kwText(k)}</Text2>
        </View>
        <View style={{ flex: 1 }}>
          <Knopf titel="▶" art="neben" onPress={() => setKw(kwSchluessel(plusWochen(k, 1)))} />
        </View>
      </View>

      <Ueberschrift>Wochentag</Ueberschrift>
      <ChipReihe>
        <Chip titel="kein Tag" aktiv={!wochentag} onPress={() => setWochentag(null)} />
        {WOCHENTAGE.map((w) => (
          <Chip key={w} titel={w} aktiv={wochentag === w} onPress={() => setWochentag(w)} />
        ))}
      </ChipReihe>

      <Ueberschrift>Bereich und Rubrik</Ueberschrift>
      <ChipReihe>
        {(Object.keys(BEREICHE) as Bereich[]).map((b) => (
          <Chip key={b} titel={BEREICHE[b].label} aktiv={bereich === b} onPress={() => setBereich(b)} />
        ))}
      </ChipReihe>
      <ChipReihe>
        {BEREICHE[bereich].rubriken.map((r) => (
          <Chip key={r} titel={r} aktiv={rubrik === r} onPress={() => setRubrik(r)} />
        ))}
      </ChipReihe>

      {e.checkpunkte.length ? (
        <Text2 leise>Checkpunkte: {e.checkpunkte.map((c) => c.text).join(' · ')}</Text2>
      ) : null}
      {e.ki === 'ausstehend' ? <Text2 leise>KI-Ausformulierung wird nachgeholt, sobald Netz da ist.</Text2> : null}

      <View style={{ gap: 12, marginTop: 8 }}>
        <Knopf titel="Speichern" icon="content-save" onPress={speichern} testID="speichern" />
        <Knopf titel="Abbrechen" art="neben" onPress={() => router.back()} />
        <Knopf titel="Eintrag löschen" art="gefahr" icon="delete" onPress={loeschen} />
      </View>
    </Seite>
  );
}
