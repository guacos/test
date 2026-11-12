import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { UNTERLAGEN_ARTEN, type Unterlage } from '../../domain/types';
import { groesseText, veralteteIds } from '../../domain/unterlagen';
import { oeffneGespeicherteDatei } from '../../dienste/ausgabe';
import { sichereLokal } from '../../dienste/unterlagen';
import { existiertDatei, loescheBild } from '../../foto/dateien';
import { holeRepo, useApp } from '../../state/useApp';
import { useDaten, useDatensatz } from '../../state/useDaten';
import { Abschnitt, Auswahl, Badge, Feld, Knopf, Leer, Reihe, Seite, Text2 } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';
import { ansichtImBildschirm, DateiAnsicht } from '../../ui/DateiAnsicht';
import { zurueck } from '../../ui/navigation';
import { Titel } from '../../ui/Rahmen';
import { farbe } from '../../ui/theme';
import { toast } from '../../ui/toast';

export default function UnterlageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const u = useDatensatz<Unterlage>(id);
  if (u === undefined) return <Titel text="Unterlage" zurueckZu="/unterlagen" />;
  if (!u) {
    return (
      <Seite>
        <Titel text="Unterlage" zurueckZu="/unterlagen" />
        <Leer text="Unterlage nicht gefunden." />
      </Seite>
    );
  }
  return <Ansicht key={u.id} u={u} />;
}

function Ansicht({ u }: { u: Unterlage }) {
  const geaendert = useApp((s) => s.geaendert);
  const alle = useDaten<Unterlage>('unterlage', u.projektId ?? undefined) ?? [];
  const [lokal, setLokal] = useState<boolean | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [planNr, setPlanNr] = useState(u.planNr);
  const [index, setIndex] = useState(u.index);
  const [notiz, setNotiz] = useState(u.notiz);
  const veraltet = veralteteIds(alle).has(u.id);

  useEffect(() => {
    existiertDatei(u.datei).then(setLokal);
  }, [u.datei]);

  async function laden(): Promise<boolean> {
    setLaedt(true);
    const ok = await sichereLokal(u);
    setLaedt(false);
    setLokal(ok);
    if (!ok) toast('Die Datei ist gerade nicht erreichbar (kein Netz, nicht angemeldet oder kein Zugriff auf den Kernteam-Ordner).', { fehler: true, dauerMs: 6000 });
    return ok;
  }

  async function oeffnen() {
    if (!(lokal || (await laden()))) return;
    try {
      await oeffneGespeicherteDatei(u.datei, u.name, u.mime);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Datei konnte nicht geöffnet werden', { fehler: true });
    }
  }

  const sofort = async (a: Partial<Unterlage>) => {
    await holeRepo().aendereAktuell<Unterlage>(u.id, () => a);
    geaendert();
  };

  async function speichern() {
    await sofort({ planNr: planNr.trim(), index: index.trim(), notiz: notiz.trim() });
    toast('Unterlage gespeichert');
    zurueck('/unterlagen');
  }

  async function loeschen() {
    if (!(await bestaetigen('Unterlage entfernen?', `${u.name} wird aus der App entfernt. Die Datei in OneDrive bleibt erhalten.`, 'Entfernen'))) return;
    await holeRepo().loesche(u);
    await loescheBild(u.datei);
    geaendert();
    zurueck('/unterlagen');
  }

  return (
    <Seite breit={ansichtImBildschirm}>
      <Titel text={u.name} zurueckZu="/unterlagen" />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {veraltet ? <Badge text="veraltet – es gibt einen neueren Index" ton="gelb" icon="alert-outline" /> : u.planNr ? <Badge text="aktueller Stand" ton="ok" icon="check" /> : null}
        <Badge text={lokal ? 'offline verfügbar' : 'nur in OneDrive'} ton={lokal ? 'ok' : 'neutral'} icon={lokal ? 'download-circle' : 'cloud-outline'} />
        {u.groesse ? <Badge text={groesseText(u.groesse)} /> : null}
      </View>

      {laedt ? <ActivityIndicator size="large" color={farbe.navy} /> : null}
      <Reihe>
        <Knopf titel={ansichtImBildschirm ? 'In neuem Tab öffnen' : 'Öffnen'} icon="open-in-new" art="navy" onPress={oeffnen} testID="unterlage-oeffnen" />
        {lokal === false ? <Knopf titel="Für offline laden" icon="cloud-download" art="neben" onPress={laden} testID="unterlage-laden" /> : null}
      </Reihe>
      {!ansichtImBildschirm && u.mime === 'application/pdf' ? (
        <Text2 leise>Das PDF öffnet sich in der PDF-Anzeige deines Handys – mit Zoom und Seitenwahl, auch ohne Netz, sobald es einmal geladen wurde.</Text2>
      ) : null}
      {lokal ? <DateiAnsicht datei={u.datei} mime={u.mime} name={u.name} /> : null}

      <Abschnitt titel="Einordnung">
        <Auswahl label="Art" werte={UNTERLAGEN_ARTEN} wert={u.art} onChange={(w) => w && sofort({ art: w })} testID="unterlage-art" />
        <Reihe>
          <Feld label="Plan-Nr." value={planNr} onChangeText={setPlanNr} autoCapitalize="characters" placeholder="z. B. A-101" testID="feld-plan-nr" />
          <Feld label="Index" value={index} onChangeText={setIndex} autoCapitalize="characters" placeholder="z. B. C" testID="feld-plan-index" />
        </Reihe>
        <Text2 leise>
          Unterlagen mit derselben Plan-Nr. gelten als Stände desselben Plans. Der höchste Index ist der aktuelle – nur er wird vom KI-Assistenten verwendet.
        </Text2>
        <Feld label="Notiz" value={notiz} onChangeText={setNotiz} multiline />
        {u.oneDrivePfad ? <Text2 leise>OneDrive: _Kernteam/…/{u.oneDrivePfad}</Text2> : <Text2 leise>Noch nicht in OneDrive hochgeladen.</Text2>}
      </Abschnitt>

      <View style={{ gap: 12, marginTop: 12 }}>
        <Knopf titel="Speichern" icon="content-save" onPress={speichern} testID="speichern" />
        <Knopf titel="Aus der App entfernen" art="gefahr" icon="delete" onPress={loeschen} testID="loeschen" />
      </View>
    </Seite>
  );
}
