import { router } from 'expo-router';
import { Text, View } from 'react-native';
import type { Protokoll, ProtokollPunkt } from '../../domain/types';
import { useAktivesProjekt } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Leer, Seite, Text2, Ueberschrift, Zeile } from '../../ui/bausteine';
import { MitProjekt } from '../../ui/Rahmen';
import { farbe, groesse } from '../../ui/theme';

export default function JourFixeScreen() {
  return (
    <MitProjekt>
      <Liste />
    </MitProjekt>
  );
}

function datum(iso: string) {
  const [j, m, t] = iso.split('-');
  return `${t}.${m}.${j}`;
}

/** Vorläufige Ansicht – vollständige Protokolle mit Farben und PDF folgen in Schritt 5. */
function Liste() {
  const projekt = useAktivesProjekt()!;
  const protokolle = useDaten<Protokoll>('protokoll', projekt.id);
  const punkte = useDaten<ProtokollPunkt>('protokollpunkt', projekt.id);
  if (!protokolle || !punkte) return null;
  const sortiert = [...protokolle].sort((a, b) => b.nr - a.nr);

  return (
    <Seite>
      <Ueberschrift>Jour-Fixe-Protokolle</Ueberschrift>
      {sortiert.length === 0 ? <Leer text="Noch keine Protokolle. Erfasse z. B. „jf Brandschutz klären“ über den Plus-Knopf." /> : null}
      {sortiert.map((p) => {
        const eigene = punkte.filter((x) => x.protokollId === p.id).sort((a, b) => a.reihenfolge - b.reihenfolge);
        const offen = eigene.filter((x) => x.status === 'offen').length;
        return (
          <View key={p.id} style={{ gap: 8 }}>
            <Text style={{ fontSize: groesse.schrift, fontWeight: '800', color: farbe.text }}>
              Protokoll Nr. {p.nr} · {datum(p.datum)} · {p.status === 'entwurf' ? 'Entwurf' : 'abgeschlossen'} · {offen} offen
            </Text>
            {eigene.map((x) => (
              <Zeile
                key={x.id}
                titel={x.thema}
                untertitel={[x.ursprungNr !== p.nr ? `offen seit Nr. ${x.ursprungNr}` : 'neu', x.ki === 'ausstehend' ? 'KI folgt' : null]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => router.push({ pathname: '/jourfixe/punkt/[id]', params: { id: x.id } })}
              />
            ))}
          </View>
        );
      })}
      <Text2 leise>Vollständige Protokolle mit Farben, Teilnehmern und PDF folgen in Schritt 5.</Text2>
    </Seite>
  );
}
