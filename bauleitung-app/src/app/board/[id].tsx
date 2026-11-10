import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ausSchluessel, kwSchluessel, kwText, plusWochen } from '../../domain/kw';
import { BEREICHE, PRUEFKETTE, WOCHENTAGE, type Bereich, type BoardEintrag, type Wochentag, type Woche } from '../../domain/types';
import { neueId } from '../../lib/id';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { useDatensatz } from '../../state/useDaten';
import { Abschnitt, Auswahl, Chip, ChipReihe, Feld, Haken, IconKnopf, Karte, Knopf, Leer, SchalterZeile, Seite, Text2 } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';
import { FotoLeiste } from '../../ui/FotoLeiste';
import { Titel } from '../../ui/Rahmen';
import { farbe, groesse } from '../../ui/theme';
import { toast } from '../../ui/toast';

export default function BoardEintragScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const e = useDatensatz<BoardEintrag>(id);
  if (e === undefined) return <Titel text="Eintrag" />;
  if (!e) {
    return (
      <Seite>
        <Titel text="Eintrag" />
        <Leer text="Eintrag nicht gefunden." />
      </Seite>
    );
  }
  return <Formular key={e.id} e={e} />;
}

function Formular({ e }: { e: BoardEintrag }) {
  const geaendert = useApp((s) => s.geaendert);
  const projekt = useAktivesProjekt();
  // Textfelder werden mit "Speichern" übernommen; Haken, Prüfkette und Fotos sofort.
  const [titel, setTitel] = useState(e.titel);
  const [text, setText] = useState(e.text);
  const [notiz, setNotiz] = useState(e.notiz);
  const [wochentag, setWochentag] = useState<Wochentag | null>(e.wochentag);
  const [kw, setKw] = useState(e.kw);
  const [bereich, setBereich] = useState<Bereich>(e.bereich);
  const [rubrik, setRubrik] = useState(e.rubrik);
  const [neuerPunkt, setNeuerPunkt] = useState('');

  useEffect(() => {
    if (!BEREICHE[bereich].rubriken.includes(rubrik)) setRubrik(BEREICHE[bereich].rubriken[0]);
  }, [bereich, rubrik]);

  const k = ausSchluessel(kw)!;
  const sofort = async (aenderung: (akt: BoardEintrag) => Partial<BoardEintrag>) => {
    await holeRepo().aendereAktuell<BoardEintrag>(e.id, aenderung);
    geaendert();
  };

  async function speichern() {
    const repo = holeRepo();
    const wochen = await repo.alle<Woche>('woche', e.projektId);
    if (!wochen.some((w) => w.kw === kw)) await repo.neu<Woche>('woche', e.projektId, { kw });
    await repo.aendereAktuell<BoardEintrag>(e.id, () => ({
      titel: titel.trim() || e.titel,
      text: text.trim(),
      notiz: notiz.trim(),
      wochentag,
      kw,
      bereich,
      rubrik,
    }));
    useApp.setState({ boardKw: kw });
    geaendert();
    toast('Eintrag gespeichert');
    router.back();
  }

  async function loeschen() {
    if (!(await bestaetigen('Eintrag löschen?', e.titel))) return;
    await holeRepo().loesche(e);
    geaendert();
    toast('Eintrag gelöscht');
    router.back();
  }

  async function punktDazu() {
    const t = neuerPunkt.trim();
    if (!t) return;
    await sofort((akt) => ({ checkpunkte: [...akt.checkpunkte, { id: neueId(), text: t, erledigt: false }] }));
    setNeuerPunkt('');
  }

  return (
    <Seite>
      <Titel text="Eintrag bearbeiten" />
      <Feld label="Titel" value={titel} onChangeText={setTitel} testID="feld-titel" />
      <Feld label="Text" value={text} onChangeText={setText} multiline testID="feld-text" />
      {e.ki === 'ausstehend' ? <Text2 leise>Die KI-Ausformulierung wird nachgeholt, sobald Netz da ist.</Text2> : null}

      <Abschnitt titel="Checkpunkte">
        <Karte>
          {e.checkpunkte.length === 0 ? <Text2 leise>Noch keine Checkpunkte.</Text2> : null}
          {e.checkpunkte.map((c) => (
            <Haken
              key={c.id}
              text={c.text}
              wert={c.erledigt}
              testID={`haken-${c.text}`}
              onChange={(v) => sofort((akt) => ({ checkpunkte: akt.checkpunkte.map((x) => (x.id === c.id ? { ...x, erledigt: v } : x)) }))}
              rechts={
                <IconKnopf
                  icon="trash-can-outline"
                  label={`Checkpunkt „${c.text}“ löschen`}
                  ton="neutral"
                  testID={`punkt-loeschen-${c.text}`}
                  onPress={() => sofort((akt) => ({ checkpunkte: akt.checkpunkte.filter((x) => x.id !== c.id) }))}
                />
              }
            />
          ))}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Feld
                label="Neuer Checkpunkt"
                value={neuerPunkt}
                onChangeText={setNeuerPunkt}
                onSubmitEditing={punktDazu}
                placeholder="z. B. Lagerfläche definieren"
                testID="feld-neuer-punkt"
              />
            </View>
            <IconKnopf icon="plus" label="Checkpunkt hinzufügen" ton="akzent" gross onPress={punktDazu} testID="punkt-hinzu" />
          </View>
        </Karte>
      </Abschnitt>

      <Abschnitt titel="Prüfkette">
        <Karte>
          {PRUEFKETTE.map((p, i) => (
            <Haken
              key={p.key}
              text={`${i + 1}. ${p.label}`}
              wert={e.pruefkette[p.key]}
              testID={`pruef-${p.key}`}
              onChange={(v) => sofort((akt) => ({ pruefkette: { ...akt.pruefkette, [p.key]: v } }))}
            />
          ))}
        </Karte>
      </Abschnitt>

      {rubrik === 'Lieferungen' ? (
        <SchalterZeile label="Geliefert" wert={!!e.geliefert} onChange={(v) => sofort(() => ({ geliefert: v }))} testID="schalter-geliefert" />
      ) : null}

      <Abschnitt titel="Foto und Notiz">
        {projekt ? <FotoLeiste projekt={projekt} fotoIds={e.fotoIds} onChange={(ids) => sofort(() => ({ fotoIds: ids }))} /> : null}
        <Feld label="Notiz" value={notiz} onChangeText={setNotiz} multiline testID="feld-notiz" />
      </Abschnitt>

      <Abschnitt titel="Einordnung">
        <Text style={{ fontSize: groesse.schriftKlein, fontWeight: '700', color: farbe.textLeise }}>Kalenderwoche</Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <IconKnopf icon="chevron-left" label="Woche früher" gross onPress={() => setKw(kwSchluessel(plusWochen(k, -1)))} testID="kw-zurueck" />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.text }} testID="kw-anzeige">
              {kwText(k)}
            </Text>
          </View>
          <IconKnopf icon="chevron-right" label="Woche später" gross onPress={() => setKw(kwSchluessel(plusWochen(k, 1)))} testID="kw-vor" />
        </View>
        <Auswahl label="Wochentag" werte={WOCHENTAGE} wert={wochentag} onChange={setWochentag} leerText="kein Tag" testID="tag" />
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: groesse.schriftKlein, fontWeight: '700', color: farbe.textLeise }}>Bereich</Text>
          <ChipReihe>
            {(Object.keys(BEREICHE) as Bereich[]).map((b) => (
              <Chip key={b} titel={BEREICHE[b].label} aktiv={bereich === b} onPress={() => setBereich(b)} testID={`bereich-${b}`} />
            ))}
          </ChipReihe>
        </View>
        <Auswahl label="Rubrik" werte={BEREICHE[bereich].rubriken} wert={rubrik} onChange={(r) => r && setRubrik(r)} testID="rubrik" />
      </Abschnitt>

      <View style={{ gap: 12, marginTop: 12 }}>
        <Knopf titel="Speichern" icon="content-save" onPress={speichern} testID="speichern" />
        <Knopf titel="Abbrechen" art="neben" onPress={() => router.back()} />
        <Knopf titel="Eintrag löschen" art="gefahr" icon="delete" onPress={loeschen} testID="loeschen" />
      </View>
    </Seite>
  );
}
