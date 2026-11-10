import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ausSchluessel, isoKw, kwSchluessel, kwText, montag, plusWochen } from '../../domain/kw';
import { BEREICHE, PRUEFKETTE, WOCHENTAGE, type Bereich, type BoardEintrag, type Woche } from '../../domain/types';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Badge, Chip, Haken, Leer, Seite } from '../../ui/bausteine';
import { MitProjekt } from '../../ui/Rahmen';
import { farbe, groesse, schatten, useBreit } from '../../ui/theme';

export default function BoardScreen() {
  return (
    <MitProjekt>
      <Board />
    </MitProjekt>
  );
}

function zeitraum(kw: string): string {
  const k = ausSchluessel(kw);
  if (!k) return '';
  const mo = montag(k);
  const so = new Date(mo.getFullYear(), mo.getMonth(), mo.getDate() + 6);
  const f = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
  return `${f(mo)} – ${f(so)}${so.getFullYear()}`;
}

function Karte({ e }: { e: BoardEintrag }) {
  const geaendert = useApp((s) => s.geaendert);
  const pruef = PRUEFKETTE.filter((p) => e.pruefkette[p.key]).length;

  async function haken(id: string, wert: boolean) {
    await holeRepo().aendereAktuell<BoardEintrag>(e.id, (akt) => ({
      checkpunkte: akt.checkpunkte.map((c) => (c.id === id ? { ...c, erledigt: wert } : c)),
    }));
    geaendert();
  }

  return (
    <View style={s.karte} testID={`eintrag-${e.id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${e.titel} bearbeiten`}
        testID="eintrag-oeffnen"
        onPress={() => router.push({ pathname: '/board/[id]', params: { id: e.id } })}
        style={({ pressed }) => [{ gap: 6 }, pressed && { opacity: 0.7 }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text style={s.karteTitel}>{e.titel}</Text>
          <MaterialCommunityIcons name="pencil-outline" size={20} color="#7A8492" />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {e.wochentag ? <Badge text={e.wochentag} ton="navy" icon="calendar" /> : null}
          {e.geliefert ? <Badge text="geliefert" ton="ok" icon="check" /> : null}
          <Badge text={`Prüfkette ${pruef}/4`} ton={pruef === 4 ? 'ok' : 'neutral'} />
          {e.fotoIds.length ? <Badge text={String(e.fotoIds.length)} icon="camera" /> : null}
          {e.ki === 'ausstehend' ? <Badge text="KI folgt" ton="gelb" icon="clock-outline" /> : null}
        </View>
        {e.text && e.text !== e.titel ? <Text style={s.karteText}>{e.text}</Text> : null}
        {e.notiz ? <Text style={s.karteNotiz}>Notiz: {e.notiz}</Text> : null}
      </Pressable>
      {e.checkpunkte.length ? (
        <View style={s.checkliste}>
          {e.checkpunkte.map((c) => (
            <Haken key={c.id} text={c.text} wert={c.erledigt} onChange={(v) => haken(c.id, v)} testID={`haken-${c.text}`} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Board() {
  const projekt = useAktivesProjekt()!;
  const geaendert = useApp((s) => s.geaendert);
  const gewaehlt = useApp((s) => s.boardKw);
  const wochen = useDaten<Woche>('woche', projekt.id);
  const eintraege = useDaten<BoardEintrag>('board', projekt.id);
  const breit = useBreit();
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

  const tagRang = (e: BoardEintrag) => (e.wochentag ? WOCHENTAGE.indexOf(e.wochentag) : 99);
  const dieseWoche = (eintraege ?? []).filter((e) => e.kw === aktuell).sort((a, b) => tagRang(a) - tagRang(b) || a.erstelltAm.localeCompare(b.erstelltAm));

  const bereichAnsicht = (b: Bereich) => (
    <View key={b} style={[{ gap: 12 }, breit && { flex: 1 }]}>
      <View style={s.bereichKopf}>
        <Text style={s.bereich}>{BEREICHE[b].label}</Text>
      </View>
      {BEREICHE[b].rubriken.map((r) => {
        const liste = dieseWoche.filter((e) => e.bereich === b && e.rubrik === r);
        return (
          <View key={r} style={{ gap: 8 }} testID={`rubrik-${r}`}>
            <Text style={s.rubrik}>
              {r} <Text style={s.anzahl}>{liste.length}</Text>
            </Text>
            {liste.length === 0 ? <Text style={s.leer}>Noch keine Einträge</Text> : null}
            {liste.map((e) => (
              <Karte key={e.id} e={e} />
            ))}
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: farbe.hintergrund }}>
      <View style={s.reiterHuelle}>
        <ScrollView horizontal contentContainerStyle={s.reiterInhalt} showsHorizontalScrollIndicator={false}>
          {alleKw.map((k) => (
            <Chip
              key={k}
              testID={`kw-${k}`}
              titel={kwText(ausSchluessel(k)!) + (k === heute ? ' · jetzt' : '')}
              aktiv={k === aktuell}
              onPress={() => useApp.setState({ boardKw: k })}
            />
          ))}
          <Chip titel="Neue Woche" icon="plus" onPress={neueWoche} testID="neue-woche" />
        </ScrollView>
      </View>
      <Seite breit>
        <Text style={s.zeitraum} testID="board-zeitraum">
          {kwText(ausSchluessel(aktuell)!)} · {zeitraum(aktuell)}
        </Text>
        {eintraege && eintraege.length === 0 ? (
          <Leer icon="view-dashboard-outline" text="Noch keine Einträge. Tippe auf den Plus-Knopf, z. B. „kw40 Estrich 1.OG“ oder „Donnerstag Lieferung Trockenbau“." />
        ) : null}
        <View style={breit ? { flexDirection: 'row', gap: 24, alignItems: 'flex-start' } : { gap: 20 }}>
          {(Object.keys(BEREICHE) as Bereich[]).map(bereichAnsicht)}
        </View>
      </Seite>
    </View>
  );
}

const s = StyleSheet.create({
  reiterHuelle: { backgroundColor: farbe.karte, borderBottomWidth: 1, borderBottomColor: farbe.linieLeise },
  reiterInhalt: { padding: 10, gap: 8 },
  zeitraum: { fontSize: groesse.schriftKlein + 1, color: farbe.textLeise, fontWeight: '700' },
  bereichKopf: { borderBottomWidth: 3, borderBottomColor: farbe.navy, paddingBottom: 6 },
  bereich: { fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.navy, letterSpacing: -0.2 },
  rubrik: { fontSize: groesse.schrift, fontWeight: '800', color: farbe.text },
  anzahl: { fontWeight: '700', color: farbe.textLeise, fontSize: groesse.schriftKlein },
  leer: { fontSize: groesse.schriftKlein, color: '#6B7685' },
  karte: {
    backgroundColor: farbe.karte,
    borderRadius: groesse.radius,
    borderWidth: 1,
    borderColor: farbe.linieLeise,
    padding: 14,
    gap: 8,
    ...schatten,
  },
  karteTitel: { flex: 1, fontSize: groesse.schrift + 1, fontWeight: '800', color: farbe.text, lineHeight: 23 },
  karteText: { fontSize: groesse.schriftKlein + 1, color: farbe.textLeise, lineHeight: 21 },
  karteNotiz: { fontSize: groesse.schriftKlein, color: farbe.gelb, lineHeight: 20 },
  checkliste: { borderTopWidth: 1, borderTopColor: farbe.linieLeise, paddingTop: 6 },
});
