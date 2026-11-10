import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { datumLang, heuteIso, plusTage } from '../../domain/datum';
import { isoKw, montag } from '../../domain/kw';
import type { Bautag } from '../../domain/types';
import { wetterText } from '../../domain/wetter';
import { arbeiterGesamt } from '../../dienste/bautagebuch';
import { erzeugeBautagebuchPdf, gibPdfAus } from '../../dienste/pdfAusgabe';
import { useAktivesProjekt } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Abschnitt, Knopf, Leer, Reihe, Seite, Zeile } from '../../ui/bausteine';
import { DatumFeld } from '../../ui/DatumFeld';
import { MitProjekt, Titel } from '../../ui/Rahmen';
import { farbe } from '../../ui/theme';
import { toast } from '../../ui/toast';

export default function BautagebuchScreen() {
  return (
    <>
      <Titel text="Bautagebuch" />
      <MitProjekt>
        <Liste />
      </MitProjekt>
    </>
  );
}

function Liste() {
  const projekt = useAktivesProjekt()!;
  const tage = useDaten<Bautag>('bautag', projekt.id);
  const heute = heuteIso();
  const mo = heuteIso(montag(isoKw(new Date())));
  const [von, setVon] = useState(mo);
  const [bis, setBis] = useState(plusTage(mo, 6));
  const [laeuft, setLaeuft] = useState(false);
  if (!tage) return null;
  const sortiert = [...tage].sort((a, b) => b.datum.localeCompare(a.datum));

  async function pdf() {
    const auswahl = sortiert.filter((t) => t.datum >= von && t.datum <= bis);
    if (!auswahl.length) return toast('Im gewählten Zeitraum gibt es keine Einträge', { fehler: true });
    setLaeuft(true);
    try {
      const datei = await erzeugeBautagebuchPdf(projekt, auswahl);
      await gibPdfAus(projekt.id, datei);
      toast(`${datei.name} erstellt – Ablage unter 06_Bautagebuch`);
    } catch (e) {
      toast(`PDF konnte nicht erzeugt werden: ${e instanceof Error ? e.message : e}`, { fehler: true });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Seite>
      <Knopf titel="Heute eintragen" icon="notebook-edit" onPress={() => router.push({ pathname: '/bautagebuch/[datum]', params: { datum: heute } })} testID="bautag-heute" />
      <DatumFeld label="Anderen Tag öffnen" wert="" onChange={(d) => d && router.push({ pathname: '/bautagebuch/[datum]', params: { datum: d } })} testID="bautag-anderer" />

      <Abschnitt titel="Einträge">
        {sortiert.length === 0 ? <Leer icon="notebook-outline" text="Noch keine Einträge im Bautagebuch." /> : null}
        {sortiert.map((t) => (
          <Zeile
            key={t.id}
            testID={`bautag-${t.datum}`}
            icon="calendar-today"
            titel={datumLang(t.datum)}
            untertitel={[`${arbeiterGesamt(t)} Arbeiter (${t.firmen.length} Firmen)`, wetterText(t.wetter), t.notiz.split('\n')[0]].filter(Boolean).join(' · ')}
            onPress={() => router.push({ pathname: '/bautagebuch/[datum]', params: { datum: t.datum } })}
          />
        ))}
      </Abschnitt>

      <Abschnitt titel="Als PDF ausgeben">
        <Reihe>
          <DatumFeld label="Von" wert={von} onChange={(d) => d && setVon(d)} testID="pdf-von" />
          <DatumFeld label="Bis" wert={bis} onChange={(d) => d && setBis(d)} testID="pdf-bis" />
        </Reihe>
        {laeuft ? <ActivityIndicator color={farbe.navy} /> : <Knopf titel="PDF erzeugen" icon="file-pdf-box" art="navy" onPress={pdf} testID="bautag-pdf" />}
      </Abschnitt>
    </Seite>
  );
}
