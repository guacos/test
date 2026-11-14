import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { datumDe, heuteIso } from '../../../domain/datum';
import { ergaenzungFarbe, istNeu, punktFarbe, punktHinweis, punktNr, stichtag } from '../../../domain/farblogik';
import type { Firma, Protokoll, ProtokollPunkt } from '../../../domain/types';
import { letztesProtokoll } from '../../../domain/uebernahme';
import { ergaenzungAnhaengen } from '../../../dienste/jourfixe';
import { neueId } from '../../../lib/id';
import { holeRepo, useAktivesProjekt, useApp } from '../../../state/useApp';
import { useDaten, useDatensatz } from '../../../state/useDaten';
import { Abschnitt, Auswahl, Badge, Chip, ChipReihe, Feld, IconKnopf, Karte, Knopf, Leer, Seite, Text2 } from '../../../ui/bausteine';
import { bestaetigen } from '../../../ui/bestaetigen';
import { DatumFeld } from '../../../ui/DatumFeld';
import { FotoLeiste } from '../../../ui/FotoLeiste';
import { Titel } from '../../../ui/Rahmen';
import { farbe, FARBE_PUNKT, groesse } from '../../../ui/theme';
import { toast } from '../../../ui/toast';
import { zurueck } from '../../../ui/navigation';

export default function PunktScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useDatensatz<ProtokollPunkt>(id);
  const protokoll = useDatensatz<Protokoll>(p?.protokollId);
  if (p === undefined || (p && protokoll === undefined)) return <Titel text="Punkt" zurueckZu="/jourfixe" />;
  if (!p || !protokoll) {
    return (
      <Seite>
        <Titel text="Punkt" zurueckZu="/jourfixe" />
        <Leer text="Punkt nicht gefunden." />
      </Seite>
    );
  }
  return <Formular key={p.id} p={p} protokoll={protokoll} />;
}

function Formular({ p, protokoll }: { p: ProtokollPunkt; protokoll: Protokoll }) {
  const geaendert = useApp((s) => s.geaendert);
  const projekt = useAktivesProjekt();
  const firmen = useDaten<Firma>('firma', p.projektId ?? undefined) ?? [];
  const protokolle = useDaten<Protokoll>('protokoll', p.projektId ?? undefined) ?? [];
  const [thema, setThema] = useState(p.thema);
  const [beschreibung, setBeschreibung] = useState(p.beschreibung);
  const [verantwortlich, setVerantwortlich] = useState(p.verantwortlich);
  const [ergaenzung, setErgaenzung] = useState('');

  const neu = istNeu(p, protokoll.nr);
  const gesperrt = protokoll.status === 'abgeschlossen';
  const heute = heuteIso();
  const tag = stichtag(protokoll, { istAktuell: letztesProtokoll(protokolle)?.id === protokoll.id, fuerPdf: false, heute });
  const f = punktFarbe(p, protokoll.nr, tag);
  const c = FARBE_PUNKT[f];

  const sofort = async (a: (akt: ProtokollPunkt) => Partial<ProtokollPunkt>) => {
    await holeRepo().aendereAktuell<ProtokollPunkt>(p.id, a);
    geaendert();
  };

  async function speichern() {
    await sofort(() => ({
      ...(neu ? { thema: thema.trim() || p.thema, beschreibung: beschreibung.trim() } : {}),
      verantwortlich: verantwortlich.trim(),
    }));
    if (ergaenzung.trim()) await ergaenzungAnhaengen(holeRepo(), p.id, protokoll.nr, ergaenzung, neueId);
    geaendert();
    toast('Punkt gespeichert');
    zurueck('/jourfixe');
  }

  async function ergaenze() {
    if (!ergaenzung.trim()) return;
    await ergaenzungAnhaengen(holeRepo(), p.id, protokoll.nr, ergaenzung, neueId);
    setErgaenzung('');
    geaendert();
  }

  async function loeschen() {
    if (!(await bestaetigen('Punkt entfernen?', p.thema))) return;
    await holeRepo().loesche(p);
    geaendert();
    zurueck('/jourfixe');
  }

  return (
    <Seite>
      <Titel text={`Punkt ${punktNr(p)}`} zurueckZu="/jourfixe" />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Text style={{ fontSize: groesse.schriftGross, fontWeight: '800', color: c }}>{punktNr(p)}</Text>
        <Badge text={punktHinweis(p, protokoll.nr, tag)} ton={f === 'rot' ? 'rot' : f === 'blau' ? 'blau' : 'neutral'} />
        <Badge text={`Protokoll Nr. ${protokoll.nr}`} />
      </View>
      {gesperrt ? <Text2 leise>Das Protokoll ist abgeschlossen – der Punkt kann nur gelesen werden.</Text2> : null}

      {neu ? (
        <>
          <Feld label="Thema" value={thema} onChangeText={setThema} editable={!gesperrt} testID="feld-thema" />
          <Feld label="Beschreibung" value={beschreibung} onChangeText={setBeschreibung} multiline editable={!gesperrt} testID="feld-beschreibung" />
          {p.ki === 'ausstehend' ? <Text2 leise>Die KI-Ausformulierung wird nachgeholt, sobald Netz da ist.</Text2> : null}
        </>
      ) : (
        <Karte balken={farbe.text}>
          <Text style={{ fontSize: groesse.schrift + 1, fontWeight: '800', color: farbe.text }}>{p.thema}</Text>
          {p.beschreibung && p.beschreibung.trim().toLowerCase() !== p.thema.trim().toLowerCase() ? <Text2>{p.beschreibung}</Text2> : null}
          <Text2 leise>Aus Protokoll Nr. {p.ursprungNr} übernommen – der Text bleibt stehen. Neues bitte als Ergänzung anhängen.</Text2>
        </Karte>
      )}

      <Abschnitt titel="Ergänzungen">
        {p.ergaenzungen.length === 0 ? <Text2 leise>Noch keine Ergänzungen.</Text2> : null}
        {p.ergaenzungen.map((e) => {
          const ef = ergaenzungFarbe(e, protokoll.nr);
          return (
            <View key={e.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Text style={{ flex: 1, fontSize: groesse.schrift, lineHeight: 24, color: FARBE_PUNKT[ef] }} testID="ergaenzung">
                <Text style={{ fontWeight: '800' }}>{datumDe(e.datum)}: </Text>
                {e.text}
              </Text>
              {ef === 'blau' && !gesperrt ? (
                <IconKnopf
                  icon="trash-can-outline"
                  label="Ergänzung löschen"
                  ton="neutral"
                  onPress={() => sofort((akt) => ({ ergaenzungen: akt.ergaenzungen.filter((x) => x.id !== e.id) }))}
                />
              ) : null}
            </View>
          );
        })}
        {!gesperrt ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Feld label={`Neue Ergänzung (${datumDe(heute)})`} value={ergaenzung} onChangeText={setErgaenzung} multiline testID="feld-ergaenzung" />
            </View>
            <IconKnopf icon="plus" label="Ergänzung anhängen" ton="akzent" gross onPress={ergaenze} testID="ergaenzung-hinzu" />
          </View>
        ) : null}
      </Abschnitt>

      <Abschnitt titel="Verantwortlich, Frist, Status">
        <Feld label="Verantwortlich" value={verantwortlich} onChangeText={setVerantwortlich} editable={!gesperrt} testID="feld-verantwortlich" />
        {firmen.length && !gesperrt ? (
          <ChipReihe>
            {firmen.map((fi) => (
              <Chip key={fi.id} titel={fi.name} aktiv={verantwortlich === fi.name} onPress={() => setVerantwortlich(fi.name)} />
            ))}
          </ChipReihe>
        ) : null}
        {gesperrt ? (
          <Text2>Frist: {p.frist ? datumDe(p.frist) : '–'}</Text2>
        ) : (
          <DatumFeld label="Frist" wert={p.frist} onChange={(d) => sofort(() => ({ frist: d }))} leerbar testID="feld-frist" />
        )}
        {gesperrt ? (
          <Text2>Status: {p.status === 'erledigt' ? 'Erledigt' : 'Offen'}</Text2>
        ) : (
          <Auswahl
            label="Status"
            werte={['Offen', 'Erledigt'] as const}
            wert={p.status === 'erledigt' ? 'Erledigt' : 'Offen'}
            onChange={(w) => w && sofort(() => ({ status: w === 'Erledigt' ? 'erledigt' : 'offen' }))}
            testID="status"
          />
        )}
      </Abschnitt>

      {projekt && !gesperrt ? (
        <Abschnitt titel="Bilder und Planausschnitte">
          <FotoLeiste projekt={projekt} fotoIds={p.fotoIds} onChange={(ids) => sofort(() => ({ fotoIds: ids }))} titel="Bilder" testID="bilder" />
          <FotoLeiste
            projekt={projekt}
            fotoIds={p.planausschnittIds}
            onChange={(ids) => sofort(() => ({ planausschnittIds: ids }))}
            ablage="anhang"
            titel="Planausschnitte"
            testID="plan"
          />
        </Abschnitt>
      ) : null}

      {!gesperrt ? (
        <View style={{ gap: 12, marginTop: 12 }}>
          <Knopf titel="Speichern" icon="content-save" onPress={speichern} testID="speichern" />
          <Knopf titel="Abbrechen" art="neben" onPress={() => zurueck('/jourfixe')} />
          <Knopf titel="Punkt entfernen" art="gefahr" icon="delete" onPress={loeschen} testID="loeschen" />
        </View>
      ) : null}
    </Seite>
  );
}
