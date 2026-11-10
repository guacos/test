import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { heuteIso } from '../../domain/datum';
import type { Firma, Foto, Mangel, Plan } from '../../domain/types';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { useDaten, useDatensatz } from '../../state/useDaten';
import { Abschnitt, Auswahl, Chip, ChipReihe, Feld, Knopf, Leer, Seite, Text2 } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';
import { DatumFeld } from '../../ui/DatumFeld';
import { FotoLeiste } from '../../ui/FotoLeiste';
import { PlanPin } from '../../ui/PlanPin';
import { Titel } from '../../ui/Rahmen';
import { farbe, groesse } from '../../ui/theme';
import { toast } from '../../ui/toast';

export default function MangelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const m = useDatensatz<Mangel>(id);
  if (m === undefined) return <Titel text="Mangel" />;
  if (!m) {
    return (
      <Seite>
        <Titel text="Mangel" />
        <Leer text="Mangel nicht gefunden." />
      </Seite>
    );
  }
  return <Formular key={m.id} m={m} />;
}

function Formular({ m }: { m: Mangel }) {
  const projekt = useAktivesProjekt();
  const geaendert = useApp((s) => s.geaendert);
  const geschosse = useApp((s) => s.geschosse);
  const firmen = useDaten<Firma>('firma', m.projektId ?? undefined) ?? [];
  const plaene = useDaten<Plan>('plan', m.projektId ?? undefined) ?? [];
  const fotos = useDaten<Foto>('foto', m.projektId ?? undefined) ?? [];
  const [titel, setTitel] = useState(m.titel);
  const [beschreibung, setBeschreibung] = useState(m.beschreibung);
  const [firmaName, setFirmaName] = useState(m.firmaName);
  const [ort, setOrt] = useState(m.ort);

  const sofort = async (a: (akt: Mangel) => Partial<Mangel>) => {
    await holeRepo().aendereAktuell<Mangel>(m.id, a);
    geaendert();
  };

  async function speichern() {
    if (!titel.trim()) return toast('Bitte einen Titel eingeben', { fehler: true });
    const firma = firmen.find((f) => f.name.toLowerCase() === firmaName.trim().toLowerCase());
    await sofort(() => ({
      titel: titel.trim(),
      beschreibung: beschreibung.trim(),
      firmaName: firma?.name ?? firmaName.trim(),
      firmaId: firma?.id ?? null,
      ort: ort.trim(),
    }));
    toast('Mangel gespeichert');
    router.back();
  }

  async function loeschen() {
    if (!(await bestaetigen('Mangel löschen?', `${m.nr} · ${m.titel || '(ohne Titel)'}`))) return;
    await holeRepo().loesche(m);
    geaendert();
    router.back();
  }

  const plan = plaene.find((p) => p.id === m.planId);
  const planFoto = plan ? fotos.find((f) => f.id === plan.fotoId) : undefined;

  return (
    <Seite>
      <Titel text={`Mangel ${m.nr}`} />
      <Feld label="Titel *" value={titel} onChangeText={setTitel} placeholder="z. B. Revisionsklappe fehlt" testID="feld-mangel-titel" autoFocus={!m.titel} />
      <Feld label="Beschreibung" value={beschreibung} onChangeText={setBeschreibung} multiline testID="feld-mangel-beschreibung" />

      {projekt ? (
        <FotoLeiste projekt={projekt} fotoIds={m.fotoIds} onChange={(ids) => sofort(() => ({ fotoIds: ids }))} tags={['Mangel']} testID="mangel-fotos" />
      ) : null}

      <Abschnitt titel="Firma und Frist">
        <Feld label="Firma" value={firmaName} onChangeText={setFirmaName} testID="feld-mangel-firma" />
        {firmen.length ? (
          <ChipReihe>
            {firmen.map((f) => (
              <Chip key={f.id} titel={f.name} aktiv={firmaName === f.name} onPress={() => setFirmaName(f.name)} testID={`mangel-firma-${f.name}`} />
            ))}
          </ChipReihe>
        ) : (
          <Text2 leise>Tipp: Unter „Firmen“ angelegte Nachunternehmer erscheinen hier zur Auswahl.</Text2>
        )}
        <DatumFeld label="Frist" wert={m.frist} onChange={(d) => sofort(() => ({ frist: d }))} leerbar testID="mangel-frist" />
        <Auswahl
          label="Status"
          werte={['Offen', 'Erledigt'] as const}
          wert={m.status === 'erledigt' ? 'Erledigt' : 'Offen'}
          onChange={(w) => w && sofort(() => ({ status: w === 'Erledigt' ? 'erledigt' : 'offen', erledigtAm: w === 'Erledigt' ? heuteIso() : '' }))}
          testID="mangel-status"
        />
      </Abschnitt>

      <Abschnitt titel="Ort">
        <Feld label="Geschoss / Bereich / Raum" value={ort} onChangeText={setOrt} placeholder="z. B. 1.OG Flur" testID="feld-mangel-ort" />
        <ChipReihe>
          {geschosse.map((g) => (
            <Chip key={g} titel={g} onPress={() => setOrt((alt) => (alt.trim() ? alt : g))} />
          ))}
        </ChipReihe>
      </Abschnitt>

      <Abschnitt titel="Position im Grundriss" aktion={{ titel: 'Grundrisse', icon: 'floor-plan', onPress: () => router.push('/maengel/plaene') }}>
        {plaene.length === 0 ? (
          <Text2 leise>Noch kein Grundriss hinterlegt. Unter „Grundrisse“ kannst du Pläne als Bild hinzufügen.</Text2>
        ) : (
          <ChipReihe>
            {plaene.map((p) => (
              <Chip
                key={p.id}
                titel={[p.name, p.geschoss].filter(Boolean).join(' · ')}
                aktiv={m.planId === p.id}
                onPress={() => sofort(() => (m.planId === p.id ? { planId: null, pin: null } : { planId: p.id, pin: null }))}
                testID={`plan-chip-${p.name}`}
              />
            ))}
          </ChipReihe>
        )}
        {planFoto ? (
          <View style={{ gap: 6 }}>
            <PlanPin foto={planFoto} pin={m.pin} onPin={(pin) => sofort(() => ({ pin }))} />
            <Text style={{ fontSize: groesse.schriftKlein, color: farbe.textLeise }} testID="pin-status">
              {m.pin ? 'Position gesetzt – erneut antippen, um sie zu verschieben.' : 'Tippe auf die Stelle im Grundriss.'}
            </Text>
          </View>
        ) : null}
      </Abschnitt>

      <View style={{ gap: 12, marginTop: 12 }}>
        <Knopf titel="Speichern" icon="content-save" onPress={speichern} testID="speichern" />
        <Knopf titel="Mangel löschen" art="gefahr" icon="delete" onPress={loeschen} testID="loeschen" />
      </View>
    </Seite>
  );
}
