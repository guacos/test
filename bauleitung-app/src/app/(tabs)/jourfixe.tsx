import { router } from 'expo-router';
import { View } from 'react-native';
import { datumDe, heuteIso } from '../../domain/datum';
import { stichtag, zaehlePunkte } from '../../domain/farblogik';
import type { Protokoll, ProtokollPunkt } from '../../domain/types';
import { letztesProtokoll } from '../../domain/uebernahme';
import { neuesProtokoll } from '../../dienste/jourfixe';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Badge, Karte, Knopf, Leer, Seite, Text2, Ueberschrift } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';
import { MitProjekt } from '../../ui/Rahmen';
import { farbe } from '../../ui/theme';
import { toast } from '../../ui/toast';
import { Text } from 'react-native';

export default function JourFixeScreen() {
  return (
    <MitProjekt>
      <Liste />
    </MitProjekt>
  );
}

function Liste() {
  const projekt = useAktivesProjekt()!;
  const geaendert = useApp((s) => s.geaendert);
  const protokolle = useDaten<Protokoll>('protokoll', projekt.id);
  const punkte = useDaten<ProtokollPunkt>('protokollpunkt', projekt.id);
  if (!protokolle || !punkte) return null;
  const sortiert = [...protokolle].sort((a, b) => b.nr - a.nr);
  const letztes = letztesProtokoll(protokolle);
  const heute = heuteIso();

  async function neu() {
    if (letztes?.status === 'entwurf') {
      const ok = await bestaetigen(
        'Neues Protokoll anlegen?',
        `Protokoll Nr. ${letztes.nr} wird abgeschlossen. Seine offenen Punkte werden in das neue Protokoll übernommen.`,
        'Anlegen',
      );
      if (!ok) return;
    }
    const r = await neuesProtokoll(holeRepo(), projekt.id);
    geaendert();
    toast(
      r.uebernommen
        ? `Protokoll Nr. ${r.protokoll.nr} angelegt – ${r.uebernommen} offene${r.uebernommen === 1 ? 'r Punkt' : ' Punkte'} übernommen`
        : `Protokoll Nr. ${r.protokoll.nr} angelegt`,
    );
    router.push({ pathname: '/jourfixe/[id]', params: { id: r.protokoll.id } });
  }

  return (
    <Seite>
      <Ueberschrift>Jour-Fixe-Protokolle</Ueberschrift>
      <Knopf titel="Neues Protokoll" icon="plus" onPress={neu} testID="jf-neu" />
      {sortiert.length === 0 ? (
        <Leer icon="clipboard-text-outline" text="Noch keine Protokolle. Lege eins an – oder erfasse unterwegs „jf Brandschutz klären“ über den Plus-Knopf." />
      ) : null}
      {sortiert.map((p) => {
        const eigene = punkte.filter((x) => x.protokollId === p.id);
        const tag = stichtag(p, { istAktuell: p.id === letztes?.id, fuerPdf: false, heute });
        const z = zaehlePunkte(eigene, tag);
        return (
          <Karte
            key={p.id}
            testID={`protokoll-${p.nr}`}
            balken={z.ueberfaellig ? farbe.rot : p.status === 'entwurf' ? farbe.neuBlau : farbe.linie}
            onPress={() => router.push({ pathname: '/jourfixe/[id]', params: { id: p.id } })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: farbe.text }}>Protokoll Nr. {p.nr}</Text>
              <Badge text={p.status === 'entwurf' ? 'Entwurf' : 'abgeschlossen'} ton={p.status === 'entwurf' ? 'blau' : 'neutral'} />
            </View>
            <Text2 leise>{datumDe(p.datum)}</Text2>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Badge text={`${z.gesamt} Punkte`} />
              <Badge text={`${z.offen} offen`} ton={z.offen ? 'blau' : 'ok'} />
              {z.ueberfaellig ? <Badge text={`${z.ueberfaellig} überfällig`} ton="rot" icon="alert-circle" /> : null}
            </View>
          </Karte>
        );
      })}
    </Seite>
  );
}
