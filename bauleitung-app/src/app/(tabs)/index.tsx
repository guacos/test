import { router } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ausSchluessel, isoKw, kwSchluessel, kwText, plusWochen } from '../../domain/kw';
import { BEREICHE, type Bereich, type BoardEintrag, type Woche } from '../../domain/types';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Chip, Leer, Seite, Zeile } from '../../ui/bausteine';
import { MitProjekt } from '../../ui/Rahmen';
import { farbe, groesse } from '../../ui/theme';

export default function BoardScreen() {
  return (
    <MitProjekt>
      <Board />
    </MitProjekt>
  );
}

function Board() {
  const projekt = useAktivesProjekt()!;
  const geaendert = useApp((s) => s.geaendert);
  const gewaehlt = useApp((s) => s.boardKw);
  const wochen = useDaten<Woche>('woche', projekt.id);
  const eintraege = useDaten<BoardEintrag>('board', projekt.id);
  const heute = kwSchluessel(isoKw(new Date()));
  const aktuell = gewaehlt ?? heute;

  const alleKw = useMemo(() => {
    const set = new Set<string>([heute, aktuell]);
    wochen?.forEach((w) => set.add(w.kw));
    eintraege?.forEach((e) => set.add(e.kw));
    return [...set].sort();
  }, [wochen, eintraege, heute, aktuell]);

  async function neueWoche() {
    const letzte = ausSchluessel(alleKw[alleKw.length - 1])!;
    const kw = kwSchluessel(plusWochen(letzte, 1));
    await holeRepo().neu<Woche>('woche', projekt.id, { kw });
    useApp.setState({ boardKw: kw });
    geaendert();
  }

  const dieseWoche = (eintraege ?? []).filter((e) => e.kw === aktuell);

  return (
    <View style={{ flex: 1, backgroundColor: farbe.hintergrund }}>
      <ScrollView horizontal style={s.reiter} contentContainerStyle={s.reiterInhalt} showsHorizontalScrollIndicator={false}>
        {alleKw.map((k) => (
          <Chip
            key={k}
            testID={`kw-${k}`}
            titel={kwText(ausSchluessel(k)!) + (k === heute ? ' (jetzt)' : '')}
            aktiv={k === aktuell}
            onPress={() => useApp.setState({ boardKw: k })}
          />
        ))}
        <Chip titel="+ Neue Woche" onPress={neueWoche} testID="neue-woche" />
      </ScrollView>
      <Seite>
        {(Object.keys(BEREICHE) as Bereich[]).map((b) => (
          <View key={b} style={{ gap: 10 }}>
            <Text style={s.bereich}>{BEREICHE[b].label}</Text>
            {BEREICHE[b].rubriken.map((r) => {
              const liste = dieseWoche.filter((e) => e.bereich === b && e.rubrik === r);
              return (
                <View key={r} style={{ gap: 8 }}>
                  <Text style={s.rubrik}>
                    {r} <Text style={s.anzahl}>({liste.length})</Text>
                  </Text>
                  {liste.length === 0 ? <Text style={s.leer}>Noch keine Einträge</Text> : null}
                  {liste.map((e) => (
                    <Zeile
                      key={e.id}
                      testID={`eintrag-${e.id}`}
                      titel={(e.wochentag ? `${e.wochentag}: ` : '') + e.titel}
                      untertitel={[
                        e.text !== e.titel ? e.text : null,
                        `${e.checkpunkte.filter((c) => c.erledigt).length}/${e.checkpunkte.length} Checkpunkte`,
                        e.fotoIds.length ? `${e.fotoIds.length} Foto` : null,
                        e.ki === 'ausstehend' ? 'KI folgt' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                      onPress={() => router.push({ pathname: '/board/[id]', params: { id: e.id } })}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        ))}
        {eintraege && eintraege.length === 0 ? (
          <Leer text="Noch keine Einträge. Tippe auf den Plus-Knopf, z. B. „kw40 Estrich 1.OG“." />
        ) : null}
      </Seite>
    </View>
  );
}

const s = StyleSheet.create({
  reiter: { flexGrow: 0, borderBottomWidth: 2, borderBottomColor: farbe.linie },
  reiterInhalt: { padding: 10, gap: 8 },
  bereich: {
    fontSize: groesse.schriftGross,
    fontWeight: '800',
    color: farbe.navy,
    borderBottomWidth: 3,
    borderBottomColor: farbe.navy,
    paddingBottom: 4,
    marginTop: 8,
  },
  rubrik: { fontSize: groesse.schrift, fontWeight: '800', color: farbe.text },
  anzahl: { fontWeight: '400', color: farbe.textLeise },
  leer: { fontSize: groesse.schriftKlein, color: farbe.textLeise },
});
