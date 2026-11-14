import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { datumLang, heuteIso, istIsoDatum, plusTage } from '../../domain/datum';
import type { Bautag, Firma, FirmaAnwesenheit, Inhalt } from '../../domain/types';
import { wetterText } from '../../domain/wetter';
import { arbeiterGesamt, tagAendern, vortagFirmen } from '../../dienste/bautagebuch';
import { erzeugeBautagebuchPdf, gibPdfAus } from '../../dienste/pdfAusgabe';
import { holeWetter } from '../../dienste/wetter';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Abschnitt, Badge, Chip, ChipReihe, Feld, IconKnopf, Karte, Knopf, Leer, Reihe, Seite, Text2, Zaehler } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';
import { DiktatKnopf, diktatVerfuegbar } from '../../ui/Diktat';
import { FotoLeiste } from '../../ui/FotoLeiste';
import { MitProjekt, Titel } from '../../ui/Rahmen';
import { farbe, groesse } from '../../ui/theme';
import { toast } from '../../ui/toast';
import { zurueck } from '../../ui/navigation';

export default function BautagScreen() {
  const { datum } = useLocalSearchParams<{ datum: string }>();
  if (!datum || !istIsoDatum(datum)) {
    return (
      <Seite>
        <Titel text="Bautagebuch" zurueckZu="/bautagebuch" />
        <Leer text="Ungültiges Datum." />
      </Seite>
    );
  }
  return (
    <>
      <Titel text="Bautagebuch" zurueckZu="/bautagebuch" />
      <MitProjekt>
        <Tag key={datum} datum={datum} />
      </MitProjekt>
    </>
  );
}

function Tag({ datum }: { datum: string }) {
  const projekt = useAktivesProjekt()!;
  const geaendert = useApp((s) => s.geaendert);
  const tage = useDaten<Bautag>('bautag', projekt.id);
  const firmen = useDaten<Firma>('firma', projekt.id) ?? [];
  const tag = tage?.find((t) => t.datum === datum) ?? null;
  const [notiz, setNotiz] = useState<string | null>(null);
  const [wetterManuell, setWetterManuell] = useState<string | null>(null);
  const [neueFirma, setNeueFirma] = useState('');
  const [laedtWetter, setLaedtWetter] = useState(false);
  const [laeuftPdf, setLaeuftPdf] = useState(false);
  // Änderungen nacheinander ausführen, damit schnelles Tippen keinen Eintrag doppelt anlegt
  const kette = useRef<Promise<unknown>>(Promise.resolve());
  const wetterVersucht = useRef(false);

  const aendere = (a: (akt: Inhalt<Bautag>) => Partial<Inhalt<Bautag>>) => {
    kette.current = kette.current
      .then(() => tagAendern(holeRepo(), projekt.id, datum, a))
      .then(() => geaendert())
      .catch(() => toast('Speichern fehlgeschlagen', { fehler: true }));
    return kette.current;
  };

  const kannWetter = !!projekt.wetterAuto && projekt.lat != null && projekt.lon != null;

  async function wetterAbrufen(leise = false) {
    if (!kannWetter) return;
    setLaedtWetter(true);
    const w = await holeWetter(projekt.lat!, projekt.lon!, datum);
    setLaedtWetter(false);
    if (w) {
      setWetterManuell(null);
      await aendere(() => ({ wetter: w }));
    } else if (!leise) {
      toast('Wetter konnte nicht abgerufen werden (kein Netz oder keine Daten für diesen Tag)', { fehler: true });
    }
  }

  // Heute: Wetter automatisch holen, wenn eingeschaltet und noch keins eingetragen ist
  useEffect(() => {
    if (!tage || wetterVersucht.current) return;
    wetterVersucht.current = true;
    if (kannWetter && datum === heuteIso() && !tag?.wetter) wetterAbrufen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tage]);

  if (!tage) return null;

  const liste = tag?.firmen ?? [];
  const setzeFirmen = (f: (alt: FirmaAnwesenheit[]) => FirmaAnwesenheit[]) => aendere((akt) => ({ firmen: f(akt.firmen) }));
  const vorschlag = vortagFirmen(tage, datum, liste);
  const weitere = firmen.filter((f) => !liste.some((x) => x.name.toLowerCase() === f.name.toLowerCase()) && !vorschlag.some((x) => x.name.toLowerCase() === f.name.toLowerCase()));

  function firmaDazu(name: string, firmaId: string | null, anzahl = 1) {
    const n = name.trim();
    if (!n) return;
    setzeFirmen((alt) => (alt.some((x) => x.name.toLowerCase() === n.toLowerCase()) ? alt : [...alt, { firmaId, name: n, anzahl }]));
  }

  async function pdf() {
    await kette.current;
    const aktuell = (await holeRepo().alle<Bautag>('bautag', projekt.id)).find((t) => t.datum === datum);
    if (!aktuell) return toast('Für diesen Tag ist noch nichts eingetragen', { fehler: true });
    setLaeuftPdf(true);
    try {
      const datei = await erzeugeBautagebuchPdf(projekt, [aktuell]);
      await gibPdfAus(projekt.id, datei);
      toast(`${datei.name} erstellt – Ablage unter 06_Bautagebuch`);
    } catch (e) {
      toast(`PDF konnte nicht erzeugt werden: ${e instanceof Error ? e.message : e}`, { fehler: true });
    } finally {
      setLaeuftPdf(false);
    }
  }

  async function loeschen() {
    if (!tag || !(await bestaetigen('Eintrag löschen?', datumLang(datum)))) return;
    await holeRepo().loesche(tag);
    geaendert();
    zurueck('/bautagebuch');
  }

  const notizWert = notiz ?? tag?.notiz ?? '';
  const wetterWert = wetterManuell ?? (tag?.wetter?.quelle === 'manuell' ? tag.wetter.beschreibung : '');

  return (
    <Seite>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <IconKnopf icon="chevron-left" label="Vorheriger Tag" gross onPress={() => router.replace({ pathname: '/bautagebuch/[datum]', params: { datum: plusTage(datum, -1) } })} testID="tag-zurueck" />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.text, textAlign: 'center' }} testID="tag-datum">
            {datumLang(datum)}
          </Text>
          {datum === heuteIso() ? <Badge text="heute" ton="akzent" /> : null}
        </View>
        <IconKnopf icon="chevron-right" label="Nächster Tag" gross onPress={() => router.replace({ pathname: '/bautagebuch/[datum]', params: { datum: plusTage(datum, 1) } })} testID="tag-vor" />
      </View>

      <Abschnitt titel="Wetter">
        <Karte>
          {tag?.wetter ? (
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: groesse.schrift + 1, fontWeight: '800', color: farbe.text }} testID="wetter-text">
                {wetterText(tag.wetter)}
              </Text>
              <Badge text={tag.wetter.quelle === 'dwd' ? 'Deutscher Wetterdienst, 6–18 Uhr' : 'von Hand eingetragen'} icon={tag.wetter.quelle === 'dwd' ? 'weather-partly-cloudy' : 'pencil'} />
            </View>
          ) : (
            <Text2 leise>Noch kein Wetter eingetragen.</Text2>
          )}
          {laedtWetter ? <ActivityIndicator color={farbe.navy} /> : null}
          {kannWetter ? (
            <Knopf titel="Wetter automatisch abrufen" klein art="leise" icon="weather-cloudy-clock" onPress={() => wetterAbrufen()} testID="wetter-abrufen" />
          ) : (
            <Text2 leise>
              {projekt.wetterAuto ? 'Für das automatische Wetter fehlt der Standort im Projekt.' : 'Automatisches Wetter ist für dieses Projekt ausgeschaltet (Projekt bearbeiten → Bautagebuch).'}
            </Text2>
          )}
          <Feld
            label="Wetter von Hand"
            value={wetterWert}
            onChangeText={setWetterManuell}
            onBlur={() => {
              if (wetterManuell === null) return;
              const t = wetterManuell.trim();
              aendere(() => ({ wetter: t ? { beschreibung: t, tempMin: null, tempMax: null, niederschlag: null, windMax: null, quelle: 'manuell' } : null }));
            }}
            placeholder="z. B. Regen, 4 bis 9 °C"
            testID="feld-wetter"
          />
        </Karte>
      </Abschnitt>

      <Abschnitt titel={`Firmen und Arbeiter · ${arbeiterGesamt(tag)} gesamt`}>
        {liste.length === 0 ? <Text2 leise>Noch keine Firma eingetragen.</Text2> : null}
        {liste.map((f) => (
          <Karte key={f.name} testID={`anwesend-${f.name}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ flex: 1, fontSize: groesse.schrift + 1, fontWeight: '800', color: farbe.text }}>{f.name}</Text>
              <Zaehler wert={f.anzahl} testID={`zaehler-${f.name}`} onChange={(n) => setzeFirmen((alt) => alt.map((x) => (x.name === f.name ? { ...x, anzahl: n } : x)))} />
              <IconKnopf icon="close" label={`${f.name} entfernen`} ton="neutral" onPress={() => setzeFirmen((alt) => alt.filter((x) => x.name !== f.name))} />
            </View>
          </Karte>
        ))}
        {vorschlag.length ? (
          <View style={{ gap: 8 }}>
            <Text2 leise>Vom letzten Eintrag:</Text2>
            <ChipReihe>
              {vorschlag.map((f) => (
                <Chip key={f.name} titel={`${f.name} (${f.anzahl})`} icon="plus" onPress={() => firmaDazu(f.name, f.firmaId, f.anzahl)} testID={`vortag-${f.name}`} />
              ))}
            </ChipReihe>
            <Knopf
              titel="Alle vom letzten Eintrag übernehmen"
              klein
              art="leise"
              icon="content-copy"
              onPress={() => setzeFirmen((alt) => [...alt, ...vorschlag.filter((v) => !alt.some((x) => x.name.toLowerCase() === v.name.toLowerCase()))])}
              testID="vortag-alle"
            />
          </View>
        ) : null}
        {weitere.length ? (
          <ChipReihe>
            {weitere.map((f) => (
              <Chip key={f.id} titel={f.name} icon="plus" onPress={() => firmaDazu(f.name, f.id)} testID={`firma-chip-${f.name}`} />
            ))}
          </ChipReihe>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Feld
              label="Andere Firma"
              value={neueFirma}
              onChangeText={setNeueFirma}
              onSubmitEditing={() => {
                firmaDazu(neueFirma, null);
                setNeueFirma('');
              }}
              placeholder="Firmenname"
              testID="feld-neue-firma"
            />
          </View>
          <IconKnopf
            icon="plus"
            label="Firma hinzufügen"
            ton="akzent"
            gross
            onPress={() => {
              firmaDazu(neueFirma, null);
              setNeueFirma('');
            }}
            testID="firma-hinzu"
          />
        </View>
      </Abschnitt>

      <Abschnitt titel="Notiz">
        <Feld
          label="Was war heute?"
          value={notizWert}
          onChangeText={setNotiz}
          onBlur={() => notiz !== null && notiz.trim() !== (tag?.notiz ?? '') && aendere(() => ({ notiz: notiz.trim() }))}
          multiline
          testID="feld-bautag-notiz"
        />
        {diktatVerfuegbar ? (
          <DiktatKnopf
            onText={(t) => {
              const neu = notizWert.trim() ? `${notizWert.trim()} ${t}` : t;
              setNotiz(neu);
              aendere(() => ({ notiz: neu }));
            }}
          />
        ) : null}
      </Abschnitt>

      <Abschnitt titel="Fotos">
        <FotoLeiste projekt={projekt} fotoIds={tag?.fotoIds ?? []} onChange={async (ids) => { await aendere(() => ({ fotoIds: ids })); }} />
      </Abschnitt>

      <View style={{ gap: 12, marginTop: 12 }}>
        <Reihe>
          {laeuftPdf ? <ActivityIndicator color={farbe.navy} /> : <Knopf titel="PDF" icon="file-pdf-box" art="navy" onPress={pdf} testID="tag-pdf" />}
          <Knopf titel="Fertig" icon="check" onPress={async () => { await kette.current; zurueck('/bautagebuch'); }} testID="tag-fertig" />
        </Reihe>
        {tag ? <Knopf titel="Eintrag löschen" art="gefahr" icon="delete" onPress={loeschen} /> : null}
      </View>
    </Seite>
  );
}
