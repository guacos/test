import { useState } from 'react';
import { View } from 'react-native';
import { LEERES_PROJEKT, projektOrdnerName, pruefeProjekt } from '../domain/projekt';
import type { ProjektDaten } from '../domain/types';
import { aktuellerStandort } from '../dienste/standort';
import { useApp } from '../state/useApp';
import { Abschnitt, Feld, Knopf, Reihe, SchalterZeile, Seite, Text2 } from './bausteine';
import { toast } from './toast';

function zahl(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() && isFinite(n) ? n : null;
}

/** Formular zum Anlegen und Bearbeiten eines Projekts. */
export function ProjektFormular({
  id,
  start,
  onFertig,
  onLoeschen,
}: {
  id?: string;
  start?: ProjektDaten;
  onFertig: () => void;
  onLoeschen?: () => void;
}) {
  const projekte = useApp((s) => s.projekte);
  const speichern = useApp((s) => s.projektSpeichern);
  const [d, setD] = useState<ProjektDaten>(start ?? LEERES_PROJEKT);
  const [lat, setLat] = useState(start?.lat != null ? String(start.lat) : '');
  const [lon, setLon] = useState(start?.lon != null ? String(start.lon) : '');
  const [versucht, setVersucht] = useState(false);
  const pruefung = pruefeProjekt(d, projekte, id);
  const fehler = versucht ? pruefung.fehler : {};

  const setze = <K extends keyof ProjektDaten>(k: K, v: ProjektDaten[K]) => setD((alt) => ({ ...alt, [k]: v }));

  async function speichereJetzt() {
    setVersucht(true);
    if (!pruefung.ok) return;
    await speichern(
      {
        ...d,
        nr: d.nr.trim(),
        name: d.name.trim(),
        bauherr: d.bauherr.trim(),
        adresse: d.adresse.trim(),
        wetterAuto: !!d.wetterAuto,
        lat: zahl(lat),
        lon: zahl(lon),
      },
      id,
    );
    toast('Projekt gespeichert');
    onFertig();
  }

  async function standort() {
    try {
      const s = await aktuellerStandort();
      setLat(String(s.lat));
      setLon(String(s.lon));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Standort nicht verfügbar', { fehler: true });
    }
  }

  return (
    <Seite>
      <Feld
        label="Projekt-Nr. *"
        value={d.nr}
        onChangeText={(v) => setze('nr', v)}
        fehler={fehler.nr}
        placeholder="z. B. 2026-014"
        autoCapitalize="characters"
        testID="feld-nr"
      />
      <Feld
        label="Projektname *"
        value={d.name}
        onChangeText={(v) => setze('name', v)}
        fehler={fehler.name}
        placeholder="z. B. Neubau Halle Nord"
        testID="feld-name"
      />
      <Feld label="Bauherr" value={d.bauherr} onChangeText={(v) => setze('bauherr', v)} testID="feld-bauherr" />
      <Feld label="Adresse" value={d.adresse} onChangeText={(v) => setze('adresse', v)} multiline testID="feld-adresse" />
      {pruefung.ok ? <Text2 leise>Ordner in OneDrive: Bauleitung-App/{projektOrdnerName(d)}</Text2> : null}

      <Abschnitt titel="Vertraulichkeit">
        <SchalterZeile
          label="KI erlaubt"
          wert={d.kiErlaubt}
          onChange={(v) => setze('kiErlaubt', v)}
          hinweis={
            d.kiErlaubt
              ? 'AN: Kurztexte und verkleinerte Fotos (ohne Ortsdaten) werden zum Ausformulieren und Taggen an die KI geschickt. Projektname und Bauherr werden nicht übertragen.'
              : 'AUS: Nichts verlässt dein Gerät und dein OneDrive. Zuordnung per Stichwort, Tags manuell, Suche nur lokal.'
          }
        />
      </Abschnitt>

      <Abschnitt titel="Bautagebuch">
        <SchalterZeile
          label="Wetter automatisch"
          wert={!!d.wetterAuto}
          onChange={(v) => setze('wetterAuto', v)}
          testID="schalter-wetter"
          hinweis={
            d.wetterAuto
              ? 'AN: Für das Bautagebuch werden Koordinaten und Datum an den Wetterdienst (Daten des Deutschen Wetterdienstes über brightsky.dev) geschickt – sonst nichts.'
              : 'AUS: Das Wetter trägst du im Bautagebuch selbst ein.'
          }
        />
        {d.wetterAuto ? (
          <>
            <Reihe>
              <Feld label="Breitengrad" value={lat} onChangeText={setLat} keyboardType="numbers-and-punctuation" placeholder="z. B. 51.96" testID="feld-lat" />
              <Feld label="Längengrad" value={lon} onChangeText={setLon} keyboardType="numbers-and-punctuation" placeholder="z. B. 7.63" testID="feld-lon" />
            </Reihe>
            <Knopf titel="Aktuellen Standort übernehmen" art="leise" icon="crosshairs-gps" onPress={standort} />
          </>
        ) : null}
      </Abschnitt>

      <View style={{ gap: 12, marginTop: 12 }}>
        <Knopf titel="Speichern" icon="content-save" onPress={speichereJetzt} testID="projekt-speichern" />
        <Knopf titel="Abbrechen" art="neben" onPress={onFertig} />
        {onLoeschen ? <Knopf titel="Projekt löschen" art="gefahr" icon="delete" onPress={onLoeschen} /> : null}
      </View>
    </Seite>
  );
}
