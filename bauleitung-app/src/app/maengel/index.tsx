import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { datumDe, heuteIso } from '../../domain/datum';
import type { Mangel } from '../../domain/types';
import { erzeugeMaengelPdf, gibPdfAus } from '../../dienste/pdfAusgabe';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Badge, Chip, ChipReihe, Karte, Knopf, Leer, Reihe, Seite } from '../../ui/bausteine';
import { MitProjekt, Titel } from '../../ui/Rahmen';
import { farbe, groesse } from '../../ui/theme';
import { toast } from '../../ui/toast';

export default function MaengelScreen() {
  return (
    <>
      <Titel text="Mängel" />
      <MitProjekt>
        <Liste />
      </MitProjekt>
    </>
  );
}

type Sicht = 'offen' | 'erledigt' | 'alle';

function Liste() {
  const projekt = useAktivesProjekt()!;
  const geaendert = useApp((s) => s.geaendert);
  const maengel = useDaten<Mangel>('mangel', projekt.id);
  const [sicht, setSicht] = useState<Sicht>('offen');
  const [pdfFirma, setPdfFirma] = useState<string | null>(null);
  const heute = heuteIso();
  if (!maengel) return null;

  async function neu() {
    const nr = maengel!.reduce((m, x) => Math.max(m, x.nr), 0) + 1;
    const m = await holeRepo().neu<Mangel>('mangel', projekt.id, {
      nr,
      titel: '',
      beschreibung: '',
      firmaId: null,
      firmaName: '',
      ort: '',
      frist: '',
      status: 'offen',
      erledigtAm: '',
      fotoIds: [],
      planId: null,
      pin: null,
    });
    geaendert();
    router.push({ pathname: '/maengel/[id]', params: { id: m.id } });
  }

  async function pdf(firma: string) {
    setPdfFirma(firma);
    try {
      const liste = maengel!.filter((m) => (m.firmaName || 'Ohne Firma') === firma);
      const datei = await erzeugeMaengelPdf(projekt, firma, liste);
      await gibPdfAus(projekt.id, datei);
      toast(`${datei.name} erstellt – Ablage unter ${datei.pfad.split('/').slice(0, 2).join('/')}`);
    } catch (e) {
      toast(`PDF konnte nicht erzeugt werden: ${e instanceof Error ? e.message : e}`, { fehler: true });
    } finally {
      setPdfFirma(null);
    }
  }

  const sichtbar = maengel.filter((m) => sicht === 'alle' || m.status === sicht);
  const firmen = [...new Set(sichtbar.map((m) => m.firmaName || 'Ohne Firma'))].sort((a, b) => a.localeCompare(b, 'de'));
  const offen = maengel.filter((m) => m.status === 'offen').length;

  return (
    <Seite>
      <Reihe>
        <Knopf titel="Neuer Mangel" icon="plus" onPress={neu} testID="mangel-neu" />
        <Knopf titel="Grundrisse" icon="floor-plan" art="neben" onPress={() => router.push('/maengel/plaene')} testID="mangel-plaene" />
      </Reihe>
      <ChipReihe>
        <Chip titel={`Offen (${offen})`} aktiv={sicht === 'offen'} onPress={() => setSicht('offen')} testID="sicht-offen" />
        <Chip titel={`Erledigt (${maengel.length - offen})`} aktiv={sicht === 'erledigt'} onPress={() => setSicht('erledigt')} testID="sicht-erledigt" />
        <Chip titel={`Alle (${maengel.length})`} aktiv={sicht === 'alle'} onPress={() => setSicht('alle')} testID="sicht-alle" />
      </ChipReihe>
      {sichtbar.length === 0 ? <Leer icon="check-decagram-outline" text={maengel.length ? 'Keine Mängel in dieser Ansicht.' : 'Noch keine Mängel erfasst.'} /> : null}
      {firmen.map((firma) => {
        const liste = sichtbar.filter((m) => (m.firmaName || 'Ohne Firma') === firma).sort((a, b) => a.nr - b.nr);
        return (
          <View key={firma} style={{ gap: 8 }} testID={`gruppe-${firma}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, borderBottomWidth: 2, borderBottomColor: farbe.navy, paddingBottom: 6 }}>
              <Text style={{ flex: 1, fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.navy }}>
                {firma} <Text style={{ fontSize: groesse.schriftKlein, color: farbe.textLeise }}>{liste.length}</Text>
              </Text>
              {pdfFirma === firma ? <ActivityIndicator color={farbe.navy} /> : <Knopf titel="Mängelliste PDF" klein art="leise" icon="file-pdf-box" onPress={() => pdf(firma)} testID={`pdf-${firma}`} />}
            </View>
            {liste.map((m) => {
              const rot = m.status === 'offen' && !!m.frist && m.frist < heute;
              return (
                <Karte
                  key={m.id}
                  testID={`mangel-${m.nr}`}
                  balken={rot ? farbe.rot : m.status === 'erledigt' ? farbe.ok : farbe.akzent}
                  onPress={() => router.push({ pathname: '/maengel/[id]', params: { id: m.id } })}
                >
                  <Text style={{ fontSize: groesse.schrift + 1, fontWeight: '800', color: rot ? farbe.rot : farbe.text }}>
                    {m.nr} · {m.titel || '(ohne Titel)'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <Badge text={m.status === 'erledigt' ? 'Erledigt' : rot ? 'Überfällig' : 'Offen'} ton={m.status === 'erledigt' ? 'ok' : rot ? 'rot' : 'akzent'} />
                    {m.ort ? <Badge text={m.ort} icon="map-marker-outline" /> : null}
                    {m.frist ? <Badge text={`Frist ${datumDe(m.frist)}`} ton={rot ? 'rot' : 'neutral'} icon="calendar" /> : null}
                    {m.fotoIds.length ? <Badge text={String(m.fotoIds.length)} icon="camera" /> : null}
                    {m.pin ? <Badge text="im Grundriss" icon="floor-plan" /> : null}
                  </View>
                </Karte>
              );
            })}
          </View>
        );
      })}
    </Seite>
  );
}
