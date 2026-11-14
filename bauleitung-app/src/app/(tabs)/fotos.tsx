import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { filtereFotos, filterWerte, gruppiereFotos, LEERER_FILTER, OHNE, type FotoFilter } from '../../domain/fotoFilter';
import { kwTextAusSchluessel } from '../../domain/kw';
import { FOTO_ARTEN, type Foto, type FotoArt } from '../../domain/types';
import { fotoAendern, fotoAnlegen, fotoLoeschen } from '../../dienste/fotos';
import { fotoAufnehmen, fotosAusGalerie, kameraVerfuegbar, type NeuesBild } from '../../foto/aufnahme';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { ALLE_PROJEKTE, useDaten } from '../../state/useDaten';
import { Badge, Chip, ChipReihe, Feld, Knopf, Leer, Reihe, SchalterZeile, Seite } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';
import { Bild } from '../../ui/Bild';
import { Blatt } from '../../ui/Blatt';
import { MitProjekt } from '../../ui/Rahmen';
import { farbe, groesse } from '../../ui/theme';
import { toast } from '../../ui/toast';

export default function FotosScreen() {
  return (
    <MitProjekt>
      <Fotos />
    </MitProjekt>
  );
}

type TagFeld = 'gewerk' | 'art' | 'geschoss';

function Kachel({ f, gewaehlt, auswahlModus, onPress, onLang }: { f: Foto; gewaehlt: boolean; auswahlModus: boolean; onPress: () => void; onLang: () => void }) {
  return (
    <Pressable
      testID={`foto-${f.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Foto ${f.gewerk ?? 'ohne Gewerk'} ${f.art ?? ''}`}
      aria-selected={gewaehlt}
      onPress={onPress}
      onLongPress={onLang}
      style={({ pressed }) => [s.kachel, gewaehlt && s.kachelGewaehlt, pressed && { opacity: 0.8 }]}
    >
      <Bild foto={f} style={s.kachelBild} />
      <View style={s.kachelInfo}>
        <Text style={s.kachelText} numberOfLines={1}>
          {[f.art ?? 'ohne Art', f.geschoss].filter(Boolean).join(' · ')}
        </Text>
        {f.kiVorschlag ? <Badge text="KI" ton="gelb" /> : null}
      </View>
      {auswahlModus ? (
        <View style={[s.kachelHaken, gewaehlt && { backgroundColor: farbe.akzent, borderColor: farbe.akzent }]}>
          {gewaehlt ? <MaterialCommunityIcons name="check-bold" size={18} color={farbe.weiss} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function Fotos() {
  const projekt = useAktivesProjekt()!;
  const projekte = useApp((s) => s.projekte);
  const gewerke = useApp((s) => s.gewerke);
  const geschosse = useApp((s) => s.geschosse);
  const geaendert = useApp((s) => s.geaendert);
  const [alleProjekte, setAlleProjekte] = useState(false);
  const fotos = useDaten<Foto>('foto', alleProjekte ? ALLE_PROJEKTE : projekt.id);
  const [filter, setFilter] = useState<FotoFilter>(LEERER_FILTER);
  const [filterOffen, setFilterOffen] = useState(false);
  const [auswahl, setAuswahl] = useState<string[] | null>(null);
  const [tagFeld, setTagFeld] = useState<TagFeld | null>(null);
  const [laedt, setLaedt] = useState(false);

  const werte = useMemo(() => filterWerte(fotos ?? []), [fotos]);
  const gefiltert = useMemo(() => filtereFotos(fotos ?? [], filter), [fotos, filter]);
  const aktiveFilter = [filter.gewerk, filter.art, filter.kw, filter.geschoss].filter((x) => x !== null).length;

  // Projekt → KW → Gewerk
  const gruppen = useMemo(() => {
    const proProjekt = new Map<string, Foto[]>();
    for (const f of gefiltert) proProjekt.set(f.projektId ?? '', [...(proProjekt.get(f.projektId ?? '') ?? []), f]);
    return [...proProjekt.entries()].map(([pid, liste]) => ({
      projekt: projekte.find((p) => p.id === pid),
      kws: gruppiereFotos(liste),
    }));
  }, [gefiltert, projekte]);

  async function hinzufuegen(quelle: 'kamera' | 'galerie') {
    try {
      setLaedt(true);
      const bilder: NeuesBild[] = quelle === 'kamera' ? [await fotoAufnehmen()].filter((b): b is NeuesBild => !!b) : await fotosAusGalerie(true);
      if (!bilder.length) return;
      const ids: string[] = [];
      for (const b of bilder) ids.push((await fotoAnlegen(holeRepo(), projekt, b)).id);
      geaendert();
      setAlleProjekte(false);
      setFilter(LEERER_FILTER);
      useApp.getState().nachholen().catch(() => {});
      if (projekt.kiErlaubt) {
        toast(`${ids.length} Foto${ids.length === 1 ? '' : 's'} hinzugefügt – die KI schlägt Gewerk und Art vor`);
      } else {
        // KI aus: KW ist automatisch gesetzt, Gewerk und Art gleich für alle neuen Fotos wählen
        setAuswahl(ids);
        toast(`${ids.length} Foto${ids.length === 1 ? '' : 's'} hinzugefügt – jetzt Gewerk und Art wählen`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Fotos konnten nicht hinzugefügt werden', { fehler: true });
    } finally {
      setLaedt(false);
    }
  }

  function tippe(f: Foto) {
    if (auswahl) setAuswahl(auswahl.includes(f.id) ? auswahl.filter((x) => x !== f.id) : [...auswahl, f.id]);
    else router.push({ pathname: '/fotos/[id]', params: { id: f.id } });
  }

  async function setzeTag(feld: TagFeld, wert: string | null) {
    if (!auswahl?.length) return;
    for (const id of auswahl) await fotoAendern(holeRepo(), id, { [feld]: wert });
    geaendert();
    setTagFeld(null);
    toast(`${auswahl.length} Foto${auswahl.length === 1 ? '' : 's'} geändert`);
  }

  async function loescheAuswahl() {
    if (!auswahl?.length) return;
    if (!(await bestaetigen('Fotos löschen?', `${auswahl.length} Foto(s) werden aus der App und aus OneDrive entfernt.`))) return;
    for (const id of auswahl) await fotoLoeschen(holeRepo(), id);
    geaendert();
    setAuswahl(null);
  }

  const setze = (teil: Partial<FotoFilter>) => setFilter((f) => ({ ...f, ...teil }));
  const tagWerte: Record<TagFeld, readonly string[]> = { gewerk: gewerke, art: FOTO_ARTEN, geschoss: geschosse };
  const tagTitel: Record<TagFeld, string> = { gewerk: 'Gewerk', art: 'Art', geschoss: 'Geschoss / Bereich' };

  return (
    <View style={{ flex: 1, backgroundColor: farbe.hintergrund }}>
      <Seite breit unten={auswahl ? 230 : 140}>
        <Reihe>
          {kameraVerfuegbar ? <Knopf titel="Kamera" icon="camera" onPress={() => hinzufuegen('kamera')} testID="foto-kamera" /> : null}
          <Knopf titel={kameraVerfuegbar ? 'Aus Galerie' : 'Fotos hinzufügen'} icon="image-multiple" art={kameraVerfuegbar ? 'navy' : 'haupt'} onPress={() => hinzufuegen('galerie')} testID="foto-galerie" />
        </Reihe>
        {laedt ? <ActivityIndicator size="large" color={farbe.navy} /> : null}

        <Feld label="Suche (Gewerk, Tags, Notiz …)" value={filter.suche} onChangeText={(v) => setze({ suche: v })} placeholder="z. B. Revisionsklappe" testID="foto-suche" autoCapitalize="none" />
        <SchalterZeile label="In allen Projekten suchen" wert={alleProjekte} onChange={setAlleProjekte} testID="foto-alle-projekte" />

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip titel={aktiveFilter ? `Filter (${aktiveFilter})` : 'Filter'} icon="filter-variant" aktiv={filterOffen || aktiveFilter > 0} onPress={() => setFilterOffen(!filterOffen)} testID="foto-filter" />
          {aktiveFilter ? <Chip titel="Filter löschen" icon="close" onPress={() => setFilter((f) => ({ ...LEERER_FILTER, suche: f.suche }))} testID="foto-filter-loeschen" /> : null}
          <Chip titel={auswahl ? 'Auswahl beenden' : 'Auswählen'} icon="checkbox-multiple-marked-outline" aktiv={!!auswahl} onPress={() => setAuswahl(auswahl ? null : [])} testID="foto-auswaehlen" />
          <Text style={s.anzahl} testID="foto-anzahl">
            {gefiltert.length} Foto{gefiltert.length === 1 ? '' : 's'}
          </Text>
        </View>

        {filterOffen ? (
          <View style={s.filter}>
            <Text style={s.filterLabel}>Gewerk</Text>
            <ChipReihe>
              {werte.gewerke.map((g) => (
                <Chip key={g} titel={g} aktiv={filter.gewerk === g} onPress={() => setze({ gewerk: filter.gewerk === g ? null : g })} testID={`filter-gewerk-${g}`} />
              ))}
              {werte.hatOhneGewerk ? <Chip titel="ohne Gewerk" aktiv={filter.gewerk === OHNE} onPress={() => setze({ gewerk: filter.gewerk === OHNE ? null : OHNE })} testID="filter-gewerk-ohne" /> : null}
            </ChipReihe>
            <Text style={s.filterLabel}>Art</Text>
            <ChipReihe>
              {FOTO_ARTEN.map((a) => (
                <Chip key={a} titel={a} aktiv={filter.art === a} onPress={() => setze({ art: filter.art === a ? null : a })} testID={`filter-art-${a}`} />
              ))}
            </ChipReihe>
            <Text style={s.filterLabel}>Kalenderwoche</Text>
            <ChipReihe>
              {werte.kws.map((k) => (
                <Chip key={k} titel={kwTextAusSchluessel(k)} aktiv={filter.kw === k} onPress={() => setze({ kw: filter.kw === k ? null : k })} testID={`filter-kw-${k}`} />
              ))}
              {werte.hatUnbekannteKw ? <Chip titel="Unbekannt" aktiv={filter.kw === 'unbekannt'} onPress={() => setze({ kw: filter.kw === 'unbekannt' ? null : 'unbekannt' })} testID="filter-kw-unbekannt" /> : null}
            </ChipReihe>
            <Text style={s.filterLabel}>Geschoss / Bereich</Text>
            <ChipReihe>
              {werte.geschosse.map((g) => (
                <Chip key={g} titel={g} aktiv={filter.geschoss === g} onPress={() => setze({ geschoss: filter.geschoss === g ? null : g })} testID={`filter-geschoss-${g}`} />
              ))}
            </ChipReihe>
          </View>
        ) : null}

        {fotos && gefiltert.length === 0 ? (
          <Leer icon="image-search-outline" text={fotos.length ? 'Keine Fotos zu dieser Auswahl.' : 'Noch keine Fotos. Füge Fotos aus der Galerie hinzu oder nimm eins auf.'} />
        ) : null}

        {gruppen.map((g) => (
          <View key={g.projekt?.id ?? 'x'} style={{ gap: 12 }}>
            {alleProjekte ? (
              <Text style={s.projektTitel}>{g.projekt ? `${g.projekt.nr} · ${g.projekt.name}` : 'Unbekanntes Projekt'}</Text>
            ) : null}
            {g.kws.map((kw) => (
              <View key={kw.kw ?? 'unbekannt'} style={{ gap: 8 }}>
                <View style={s.kwKopf}>
                  <Text style={s.kwTitel}>{kwTextAusSchluessel(kw.kw)}</Text>
                  <Text style={s.kwAnzahl}>{kw.anzahl}</Text>
                </View>
                {kw.gewerke.map((gw) => (
                  <View key={gw.gewerk ?? 'ohne'} style={{ gap: 6 }}>
                    <Text style={s.gewerkTitel}>{gw.gewerk ?? 'Ohne Gewerk'}</Text>
                    <View style={s.raster}>
                      {gw.fotos.map((f) => (
                        <Kachel
                          key={f.id}
                          f={f}
                          gewaehlt={!!auswahl?.includes(f.id)}
                          auswahlModus={!!auswahl}
                          onPress={() => tippe(f)}
                          onLang={() => setAuswahl(auswahl ? auswahl : [f.id])}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      </Seite>

      {auswahl ? (
        <View style={s.leiste} testID="auswahl-leiste">
          <Text style={s.leisteText}>{auswahl.length} ausgewählt</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Knopf titel="Gewerk" klein art="navy" deaktiviert={!auswahl.length} onPress={() => setTagFeld('gewerk')} testID="auswahl-gewerk" />
            <Knopf titel="Art" klein art="navy" deaktiviert={!auswahl.length} onPress={() => setTagFeld('art')} testID="auswahl-art" />
            <Knopf titel="Geschoss" klein art="navy" deaktiviert={!auswahl.length} onPress={() => setTagFeld('geschoss')} testID="auswahl-geschoss" />
            <Knopf titel="Löschen" klein art="gefahr" deaktiviert={!auswahl.length} onPress={loescheAuswahl} testID="auswahl-loeschen" />
            <Knopf titel="Alle" klein art="neben" onPress={() => setAuswahl(gefiltert.map((f) => f.id))} testID="auswahl-alle" />
          </View>
        </View>
      ) : null}

      <Blatt sichtbar={!!tagFeld} titel={tagFeld ? `${tagTitel[tagFeld]} für ${auswahl?.length ?? 0} Foto(s)` : ''} onSchliessen={() => setTagFeld(null)}>
        {tagFeld ? (
          <ChipReihe>
            {tagWerte[tagFeld].map((w) => (
              <Chip key={w} titel={w} onPress={() => setzeTag(tagFeld, tagFeld === 'art' ? (w as FotoArt) : w)} testID={`tag-${w}`} />
            ))}
            <Chip titel="entfernen" icon="close" onPress={() => setzeTag(tagFeld, null)} />
          </ChipReihe>
        ) : null}
      </Blatt>
    </View>
  );
}

const s = StyleSheet.create({
  anzahl: { fontSize: groesse.schriftKlein + 1, fontWeight: '700', color: farbe.textLeise, marginLeft: 'auto' },
  filter: { backgroundColor: farbe.karte, borderRadius: groesse.radius, borderWidth: 1, borderColor: farbe.linieLeise, padding: 14, gap: 8 },
  filterLabel: { fontSize: groesse.schriftKlein, fontWeight: '800', color: farbe.textLeise, marginTop: 4 },
  projektTitel: { fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.navy, marginTop: 6 },
  kwKopf: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 2, borderBottomColor: farbe.navy, paddingBottom: 4, marginTop: 6 },
  kwTitel: { fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.navy },
  kwAnzahl: { fontSize: groesse.schriftKlein, fontWeight: '800', color: farbe.textLeise },
  gewerkTitel: { fontSize: groesse.schrift, fontWeight: '800', color: farbe.text },
  raster: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kachel: {
    width: 164,
    flexGrow: 1,
    maxWidth: 230,
    backgroundColor: farbe.karte,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: farbe.linieLeise,
    overflow: 'hidden',
  },
  kachelGewaehlt: { borderColor: farbe.akzent, borderWidth: 3 },
  kachelBild: { width: '100%', height: 124 },
  kachelInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, minHeight: 34 },
  kachelText: { flex: 1, fontSize: 13, fontWeight: '700', color: farbe.text },
  kachelHaken: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: farbe.weiss,
    backgroundColor: 'rgba(11,18,32,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leiste: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: farbe.karte,
    borderTopWidth: 1,
    borderTopColor: farbe.linie,
    padding: 12,
    paddingRight: 104,
    gap: 8,
  },
  leisteText: { fontSize: groesse.schrift, fontWeight: '800', color: farbe.text },
});
