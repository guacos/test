import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { UNTERLAGEN_ARTEN, type Unterlage } from '../../domain/types';
import { groesseText, planText, veralteteIds } from '../../domain/unterlagen';
import { sichereLokal, unterlagenHinzufuegen } from '../../dienste/unterlagen';
import { existiertDatei } from '../../foto/dateien';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Badge, Knopf, Leer, Reihe, Seite, Text2, Zeile } from '../../ui/bausteine';
import { MitProjekt, Titel } from '../../ui/Rahmen';
import { farbe, groesse } from '../../ui/theme';
import { toast } from '../../ui/toast';

export default function UnterlagenScreen() {
  return (
    <>
      <Titel text="Unterlagen" zurueckZu="/mehr" />
      <MitProjekt>
        <Liste />
      </MitProjekt>
    </>
  );
}

/** Welche Dateien liegen auf diesem Gerät? */
function useLokal(unterlagen: Unterlage[] | null, stand: number): Set<string> {
  const [lokal, setLokal] = useState<Set<string>>(new Set());
  useEffect(() => {
    let aktiv = true;
    (async () => {
      const s = new Set<string>();
      for (const u of unterlagen ?? []) if (await existiertDatei(u.datei)) s.add(u.id);
      if (aktiv) setLokal(s);
    })();
    return () => {
      aktiv = false;
    };
  }, [unterlagen, stand]);
  return lokal;
}

function Liste() {
  const projekt = useAktivesProjekt()!;
  const geaendert = useApp((s) => s.geaendert);
  const unterlagen = useDaten<Unterlage>('unterlage', projekt.id);
  const [arbeitet, setArbeitet] = useState<string | null>(null);
  const [stand, setStand] = useState(0);
  const lokal = useLokal(unterlagen, stand);
  if (!unterlagen) return null;
  const alt = veralteteIds(unterlagen);

  async function hinzu() {
    try {
      setArbeitet('Dateien werden hinzugefügt …');
      const neu = await unterlagenHinzufuegen(holeRepo(), projekt);
      if (neu.length) {
        geaendert();
        toast(`${neu.length} Unterlage${neu.length === 1 ? '' : 'n'} hinzugefügt`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Dateien konnten nicht hinzugefügt werden', { fehler: true });
    } finally {
      setArbeitet(null);
    }
  }

  async function alleLaden() {
    const fehlen = unterlagen!.filter((u) => !lokal.has(u.id));
    let ok = 0;
    for (const [i, u] of fehlen.entries()) {
      setArbeitet(`Lade ${i + 1} von ${fehlen.length}: ${u.name}`);
      if (await sichereLokal(u)) ok++;
    }
    setArbeitet(null);
    setStand((n) => n + 1);
    toast(ok === fehlen.length ? 'Alle Unterlagen sind offline verfügbar' : `${ok} von ${fehlen.length} geladen – der Rest ist gerade nicht erreichbar`, { fehler: ok !== fehlen.length });
  }

  return (
    <Seite>
      <Reihe>
        <Knopf titel="Dateien hinzufügen" icon="file-plus" onPress={hinzu} testID="unterlage-hinzu" />
        <Knopf titel="Frage stellen" icon="message-question" art="navy" onPress={() => router.push('/unterlagen/frage')} testID="unterlage-frage" />
      </Reihe>
      {arbeitet ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <ActivityIndicator color={farbe.navy} />
          <Text2 leise>{arbeitet}</Text2>
        </View>
      ) : null}
      <Text2 leise>
        Pläne, LV und Verträge (PDF oder Bild). Du kannst Dateien auch direkt in OneDrive in den Ordner „Bauleitung-App/_Kernteam/{'{Projekt}'}/01_Unterlagen“ legen – sie
        erscheinen nach dem Abgleich hier. Dieser Ordner wird nicht mit dem Projektordner geteilt.
      </Text2>
      {unterlagen.length === 0 ? <Leer icon="file-document-multiple-outline" text="Noch keine Unterlagen." /> : null}
      {unterlagen.length > 0 && lokal.size < unterlagen.length ? (
        <Knopf titel={`Alle für offline laden (${unterlagen.length - lokal.size} fehlen)`} art="leise" icon="cloud-download" onPress={alleLaden} testID="unterlagen-alle-laden" />
      ) : null}
      {UNTERLAGEN_ARTEN.map((art) => {
        const liste = unterlagen.filter((u) => u.art === art).sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
        if (!liste.length) return null;
        return (
          <View key={art} style={{ gap: 8 }}>
            <Text style={{ fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.navy, borderBottomWidth: 2, borderBottomColor: farbe.navy, paddingBottom: 4, marginTop: 6 }}>
              {art === 'Plan' ? 'Pläne' : art === 'Vertrag' ? 'Verträge' : art} <Text style={{ fontSize: groesse.schriftKlein, color: farbe.textLeise }}>{liste.length}</Text>
            </Text>
            {liste.map((u) => (
              <Zeile
                key={u.id}
                testID={`unterlage-${u.name}`}
                icon={u.mime === 'application/pdf' ? 'file-pdf-box' : 'file-image'}
                ton={alt.has(u.id) ? 'neutral' : 'navy'}
                titel={u.name}
                untertitel={[planText(u), groesseText(u.groesse), lokal.has(u.id) ? 'offline verfügbar' : 'nur in OneDrive'].filter(Boolean).join(' · ')}
                rechts={alt.has(u.id) ? <Badge text="veraltet" ton="gelb" /> : u.planNr ? <Badge text="aktuell" ton="ok" /> : undefined}
                onPress={() => router.push({ pathname: '/unterlagen/[id]', params: { id: u.id } })}
              />
            ))}
          </View>
        );
      })}
    </Seite>
  );
}
