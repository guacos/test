import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { kwTextAusSchluessel } from '../../domain/kw';
import type { BoardEintrag, Firma, Foto, Lieferschein } from '../../domain/types';
import { offeneLieferungen, verknuepfeLieferung } from '../../dienste/lieferscheine';
import { holeRepo, useApp } from '../../state/useApp';
import { useDaten, useDatensatz } from '../../state/useDaten';
import { Abschnitt, Auswahl, Badge, Chip, ChipReihe, Feld, Knopf, Leer, Seite, Text2 } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';
import { Bild } from '../../ui/Bild';
import { DatumFeld } from '../../ui/DatumFeld';
import { Titel } from '../../ui/Rahmen';
import { toast } from '../../ui/toast';

export default function LieferscheinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const l = useDatensatz<Lieferschein>(id);
  if (l === undefined) return <Titel text="Lieferschein" />;
  if (!l) {
    return (
      <Seite>
        <Titel text="Lieferschein" />
        <Leer text="Lieferschein nicht gefunden." />
      </Seite>
    );
  }
  // nach dem Nachholen durch die KI mit den gelesenen Werten neu aufbauen
  return <Formular key={`${l.id}-${l.ki}`} l={l} />;
}

function Formular({ l }: { l: Lieferschein }) {
  const geaendert = useApp((s) => s.geaendert);
  const firmen = useDaten<Firma>('firma', l.projektId ?? undefined) ?? [];
  const board = useDaten<BoardEintrag>('board', l.projektId ?? undefined) ?? [];
  const foto = useDatensatz<Foto>(l.fotoId ?? undefined);
  const [lieferant, setLieferant] = useState(l.lieferant);
  const [nummer, setNummer] = useState(l.nummer);
  const [material, setMaterial] = useState(l.material);
  const [menge, setMenge] = useState(l.menge);
  const [firmaName, setFirmaName] = useState(l.firmaName);
  const [schaeden, setSchaeden] = useState(l.schaeden);
  const [lagerort, setLagerort] = useState(l.lagerort);

  const sofort = async (a: Partial<Lieferschein>) => {
    await holeRepo().aendereAktuell<Lieferschein>(l.id, () => a);
    geaendert();
  };

  async function speichern() {
    const firma = firmen.find((f) => f.name.toLowerCase() === firmaName.trim().toLowerCase());
    await sofort({
      lieferant: lieferant.trim(),
      nummer: nummer.trim(),
      material: material.trim(),
      menge: menge.trim(),
      firmaName: firma?.name ?? firmaName.trim(),
      firmaId: firma?.id ?? null,
      schaeden: schaeden.trim(),
      lagerort: lagerort.trim(),
    });
    toast('Lieferschein gespeichert');
    router.back();
  }

  async function loeschen() {
    if (!(await bestaetigen('Lieferschein löschen?', l.lieferant || 'Lieferschein'))) return;
    if (l.boardEintragId) await verknuepfeLieferung(holeRepo(), l.id, null);
    const akt = await holeRepo().holeAktiv<Lieferschein>(l.id);
    if (akt) await holeRepo().loesche(akt);
    if (foto) await holeRepo().loesche(foto);
    geaendert();
    router.back();
  }

  const lieferungen = offeneLieferungen(board, l);

  return (
    <Seite>
      <Titel text="Lieferschein" />
      {foto ? <Bild foto={foto} einpassen style={{ width: '100%', aspectRatio: foto.breite / foto.hoehe || 3 / 4, maxHeight: 460, borderRadius: 14, backgroundColor: '#0B1220' }} /> : null}
      {l.ki === 'fertig' ? <Badge text="Von der KI gelesen – bitte prüfen" ton="gelb" icon="creation" /> : null}
      {l.ki === 'ausstehend' ? <Text2 leise>Die KI liest den Lieferschein, sobald Netz da ist. Was du schon einträgst, bleibt.</Text2> : null}

      <Abschnitt titel="Angaben">
        <Feld label="Lieferant" value={lieferant} onChangeText={setLieferant} testID="ls-lieferant" />
        <DatumFeld label="Datum" wert={l.datum} onChange={(d) => sofort({ datum: d })} leerbar testID="ls-datum" />
        <Feld label="Lieferschein-Nr." value={nummer} onChangeText={setNummer} testID="ls-nummer" />
        <Feld label="Material" value={material} onChangeText={setMaterial} multiline testID="ls-material" />
        <Feld label="Menge" value={menge} onChangeText={setMenge} testID="ls-menge" />
      </Abschnitt>

      <Abschnitt titel="Zuordnung zur Firma">
        <Feld label="Firma (für wen ist die Lieferung?)" value={firmaName} onChangeText={setFirmaName} testID="ls-firma" />
        {firmen.length ? (
          <ChipReihe>
            {firmen.map((f) => (
              <Chip key={f.id} titel={f.name} aktiv={firmaName === f.name} onPress={() => setFirmaName(f.name)} testID={`ls-firma-${f.name}`} />
            ))}
          </ChipReihe>
        ) : null}
      </Abschnitt>

      <Abschnitt titel="Kurzprüfung">
        <Auswahl
          label="Menge stimmt?"
          werte={['Ja', 'Nein'] as const}
          wert={l.mengeOk === null ? null : l.mengeOk ? 'Ja' : 'Nein'}
          onChange={(w) => sofort({ mengeOk: w === null ? null : w === 'Ja' })}
          leerText="nicht geprüft"
          testID="ls-menge-ok"
        />
        <Feld label="Schäden (leer = keine)" value={schaeden} onChangeText={setSchaeden} multiline testID="ls-schaeden" />
        <Feld label="Lagerort" value={lagerort} onChangeText={setLagerort} placeholder="z. B. Halle, Achse C" testID="ls-lagerort" />
      </Abschnitt>

      <Abschnitt titel="Geplante Lieferung im Board">
        {lieferungen.length === 0 ? (
          <Text2 leise>Im Board gibt es keine offene Lieferung (Rubrik „Lieferungen“).</Text2>
        ) : (
          <>
            <Text2 leise>Wähle die geplante Lieferung – sie wird im Board als „geliefert“ markiert.</Text2>
            <View style={{ gap: 8 }}>
              {lieferungen.map((e) => (
                <Chip
                  key={e.id}
                  titel={`${kwTextAusSchluessel(e.kw)}${e.wochentag ? ` ${e.wochentag}` : ''}: ${e.titel}`}
                  icon={l.boardEintragId === e.id ? 'check' : 'truck-outline'}
                  aktiv={l.boardEintragId === e.id}
                  testID={`ls-lieferung-${e.titel}`}
                  onPress={async () => {
                    await verknuepfeLieferung(holeRepo(), l.id, l.boardEintragId === e.id ? null : e.id);
                    geaendert();
                  }}
                />
              ))}
            </View>
          </>
        )}
      </Abschnitt>

      <View style={{ gap: 12, marginTop: 12 }}>
        <Knopf titel="Speichern" icon="content-save" onPress={speichern} testID="speichern" />
        <Knopf titel="Lieferschein löschen" art="gefahr" icon="delete" onPress={loeschen} testID="loeschen" />
      </View>
    </Seite>
  );
}
