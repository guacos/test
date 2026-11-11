import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { datumDe } from '../../domain/datum';
import { ausSchluessel, isoKw, kwSchluessel, kwTextAusSchluessel, plusWochen } from '../../domain/kw';
import { FOTO_ARTEN, type Foto } from '../../domain/types';
import { fotoAendern, fotoLoeschen } from '../../dienste/fotos';
import { holeRepo, useApp } from '../../state/useApp';
import { useDatensatz } from '../../state/useDaten';
import { Abschnitt, Auswahl, Badge, Feld, IconKnopf, Knopf, Leer, Seite, Text2 } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';
import { Bild } from '../../ui/Bild';
import { Titel } from '../../ui/Rahmen';
import { farbe, groesse } from '../../ui/theme';
import { toast } from '../../ui/toast';
import { zurueck } from '../../ui/navigation';

const QUELLE: Record<Foto['kwQuelle'], string> = {
  exif: 'aus dem Aufnahmedatum (EXIF)',
  dateiname: 'aus dem Dateinamen',
  kamera: 'Aufnahme mit der App',
  manuell: 'von Hand gesetzt',
  unbekannt: 'kein Datum gefunden',
};

export default function FotoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const f = useDatensatz<Foto>(id);
  if (f === undefined) return <Titel text="Foto" zurueckZu="/fotos" />;
  if (!f) {
    return (
      <Seite>
        <Titel text="Foto" zurueckZu="/fotos" />
        <Leer text="Foto nicht gefunden." />
      </Seite>
    );
  }
  return <Ansicht key={f.id} f={f} />;
}

function Ansicht({ f }: { f: Foto }) {
  const geaendert = useApp((s) => s.geaendert);
  const gewerke = useApp((s) => s.gewerke);
  const geschosse = useApp((s) => s.geschosse);
  const [notiz, setNotiz] = useState(f.notiz);
  const [tags, setTags] = useState(f.tags.join(', '));
  const istDoku = !f.ablage || f.ablage === 'fotos';

  const setze = async (aenderung: Partial<Foto>) => {
    await fotoAendern(holeRepo(), f.id, aenderung);
    geaendert();
  };

  async function speichern() {
    await setze({
      notiz: notiz.trim(),
      tags: [...new Set(tags.split(',').map((t) => t.trim()).filter(Boolean))],
    });
    toast('Foto gespeichert');
    zurueck('/fotos');
  }

  async function loeschen() {
    if (!(await bestaetigen('Foto löschen?', 'Das Foto wird aus der App und beim nächsten Abgleich aus OneDrive entfernt.'))) return;
    await fotoLoeschen(holeRepo(), f.id);
    geaendert();
    toast('Foto gelöscht');
    zurueck('/fotos');
  }

  const k = f.kw ? ausSchluessel(f.kw) : null;
  const gewerkListe = f.gewerk && !gewerke.includes(f.gewerk) ? [f.gewerk, ...gewerke] : gewerke;
  const geschossListe = f.geschoss && !geschosse.includes(f.geschoss) ? [f.geschoss, ...geschosse] : geschosse;

  return (
    <Seite>
      <Titel text="Foto" zurueckZu="/fotos" />
      <Bild foto={f} einpassen style={{ width: '100%', aspectRatio: f.breite / f.hoehe || 4 / 3, maxHeight: 520, borderRadius: 14, backgroundColor: '#0B1220' }} />

      {f.kiVorschlag ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Badge text="Gewerk/Art: Vorschlag der KI" ton="gelb" icon="creation" />
          <Knopf titel="Vorschlag bestätigen" klein art="leise" icon="check" onPress={() => setze({ kiVorschlag: false })} testID="ki-bestaetigen" />
        </View>
      ) : null}
      {f.ki === 'ausstehend' ? <Text2 leise>Die KI schlägt Gewerk und Art vor, sobald Netz da ist.</Text2> : null}

      {istDoku ? (
        <Abschnitt titel="Tags">
          <Auswahl label="Gewerk" werte={gewerkListe} wert={f.gewerk} onChange={(w) => setze({ gewerk: w })} leerText="ohne" testID="gewerk" />
          <Auswahl label="Art" werte={FOTO_ARTEN} wert={f.art} onChange={(w) => setze({ art: w })} leerText="ohne" testID="art" />
          <Auswahl label="Geschoss / Bereich" werte={geschossListe} wert={f.geschoss} onChange={(w) => setze({ geschoss: w })} leerText="ohne" testID="geschoss" />
        </Abschnitt>
      ) : null}

      <Abschnitt titel="Kalenderwoche">
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <IconKnopf icon="chevron-left" label="Woche früher" gross onPress={() => setze({ kw: kwSchluessel(plusWochen(k ?? isoKw(new Date()), -1)) })} testID="kw-zurueck" />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.text }} testID="foto-kw">
              {kwTextAusSchluessel(f.kw)}
            </Text>
            <Text style={{ fontSize: groesse.schriftKlein, color: farbe.textLeise }}>
              {QUELLE[f.kwQuelle]}
              {f.aufnahme ? ` · ${datumDe(f.aufnahme.slice(0, 10))}` : ''}
            </Text>
          </View>
          <IconKnopf icon="chevron-right" label="Woche später" gross onPress={() => setze({ kw: kwSchluessel(plusWochen(k ?? isoKw(new Date()), 1)) })} testID="kw-vor" />
        </View>
      </Abschnitt>

      <Abschnitt titel="Weitere Angaben">
        <Feld label="Freie Tags (mit Komma trennen)" value={tags} onChangeText={setTags} placeholder="z. B. gespachtelt, Abnahme" autoCapitalize="none" testID="feld-tags" />
        <Feld label="Notiz" value={notiz} onChangeText={setNotiz} multiline testID="feld-notiz" />
        {f.oneDrivePfad ? <Text2 leise>OneDrive: {f.oneDrivePfad}</Text2> : <Text2 leise>Noch nicht in OneDrive hochgeladen.</Text2>}
        <Text2 leise>
          Erfasst von {f.erstelltVon} am {datumDe(f.erstelltAm.slice(0, 10))}
        </Text2>
      </Abschnitt>

      <View style={{ gap: 12, marginTop: 12 }}>
        <Knopf titel="Speichern" icon="content-save" onPress={speichern} testID="speichern" />
        <Knopf titel="Foto löschen" art="gefahr" icon="delete" onPress={loeschen} testID="loeschen" />
      </View>
    </Seite>
  );
}
