import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import type { Firma } from '../../domain/types';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { useDatensatz } from '../../state/useDaten';
import { Auswahl, Feld, Knopf, Leer, Reihe, Seite } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';
import { Titel } from '../../ui/Rahmen';
import { toast } from '../../ui/toast';

export default function FirmaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const neu = id === 'neu';
  const f = useDatensatz<Firma>(neu ? undefined : id);
  if (!neu && f === undefined) return <Titel text="Firma" />;
  if (!neu && !f) {
    return (
      <Seite>
        <Titel text="Firma" />
        <Leer text="Firma nicht gefunden." />
      </Seite>
    );
  }
  return <Formular key={f?.id ?? 'neu'} f={f ?? null} />;
}

function Formular({ f }: { f: Firma | null }) {
  const projekt = useAktivesProjekt();
  const geaendert = useApp((s) => s.geaendert);
  const gewerke = useApp((s) => s.gewerke);
  const [name, setName] = useState(f?.name ?? '');
  const [gewerk, setGewerk] = useState<string | null>(f?.gewerk || null);
  const [ansprechpartner, setAnsprechpartner] = useState(f?.ansprechpartner ?? '');
  const [telefon, setTelefon] = useState(f?.telefon ?? '');
  const [email, setEmail] = useState(f?.email ?? '');
  const [notiz, setNotiz] = useState(f?.notiz ?? '');
  const [fehler, setFehler] = useState<{ name?: string; email?: string }>({});

  async function speichern() {
    const fe: typeof fehler = {};
    if (!name.trim()) fe.name = 'Bitte den Firmennamen eingeben.';
    if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) fe.email = 'Das ist keine gültige E-Mail-Adresse.';
    setFehler(fe);
    if (Object.keys(fe).length || !projekt) return;
    const felder = {
      name: name.trim(),
      gewerk: gewerk ?? '',
      ansprechpartner: ansprechpartner.trim(),
      telefon: telefon.trim(),
      email: email.trim().toLowerCase(),
      notiz: notiz.trim(),
    };
    if (f) await holeRepo().aendereAktuell<Firma>(f.id, () => felder);
    else await holeRepo().neu<Firma>('firma', projekt.id, felder);
    geaendert();
    toast('Firma gespeichert');
    router.back();
  }

  async function loeschen() {
    if (!f || !(await bestaetigen('Firma löschen?', f.name))) return;
    await holeRepo().loesche(f);
    geaendert();
    router.back();
  }

  const gewerkListe = gewerk && !gewerke.includes(gewerk) ? [gewerk, ...gewerke] : gewerke;

  return (
    <Seite>
      <Titel text={f ? 'Firma bearbeiten' : 'Neue Firma'} />
      <Feld label="Firma *" value={name} onChangeText={setName} fehler={fehler.name} testID="feld-firma-name" />
      <Auswahl label="Gewerk" werte={gewerkListe} wert={gewerk} onChange={setGewerk} leerText="ohne" testID="firma-gewerk" />
      <Feld label="Ansprechpartner" value={ansprechpartner} onChangeText={setAnsprechpartner} testID="feld-ansprechpartner" />
      <Feld label="Telefon" value={telefon} onChangeText={setTelefon} keyboardType="phone-pad" testID="feld-telefon" />
      <Feld label="E-Mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" fehler={fehler.email} testID="feld-email" />
      <Feld label="Notiz" value={notiz} onChangeText={setNotiz} multiline />
      {f && (f.telefon || f.email) ? (
        <Reihe>
          {f.telefon ? <Knopf titel="Anrufen" icon="phone" art="leise" onPress={() => Linking.openURL(`tel:${f.telefon.replace(/[^\d+]/g, '')}`)} /> : null}
          {f.email ? <Knopf titel="E-Mail" icon="email-outline" art="leise" onPress={() => Linking.openURL(`mailto:${f.email}`)} /> : null}
        </Reihe>
      ) : null}
      <View style={{ gap: 12, marginTop: 12 }}>
        <Knopf titel="Speichern" icon="content-save" onPress={speichern} testID="speichern" />
        <Knopf titel="Abbrechen" art="neben" onPress={() => router.back()} />
        {f ? <Knopf titel="Firma löschen" art="gefahr" icon="delete" onPress={loeschen} /> : null}
      </View>
    </Seite>
  );
}
