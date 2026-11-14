import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { datumLang, heuteIso, wochentagVon } from '../../domain/datum';
import { istUeberfaellig } from '../../domain/farblogik';
import { istDoku } from '../../domain/fotoFilter';
import { isoKw, kwSchluessel } from '../../domain/kw';
import type { Bautag, BoardEintrag, Foto, Mangel, Protokoll, ProtokollPunkt } from '../../domain/types';
import { letztesProtokoll } from '../../domain/uebernahme';
import { wetterText } from '../../domain/wetter';
import { useAktivesProjekt, useApp } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { useSync } from '../../sync/dienst';
import { Abschnitt, Badge, Kennzahl, Raster, Seite, Zeile, type IconName } from '../../ui/bausteine';
import { MitProjekt } from '../../ui/Rahmen';
import { farbe, groesse, schatten } from '../../ui/theme';

export default function StartScreen() {
  return (
    <MitProjekt>
      <Start />
    </MitProjekt>
  );
}

function Modul({ icon, titel, pfad, testID }: { icon: IconName; titel: string; pfad: string; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={() => router.push(pfad as never)}
      style={({ pressed }) => [s.modul, pressed && { opacity: 0.75 }]}
    >
      <View style={s.modulIcon}>
        <MaterialCommunityIcons name={icon} size={26} color={farbe.navy} />
      </View>
      <Text style={s.modulText}>{titel}</Text>
    </Pressable>
  );
}

function Start() {
  const projekt = useAktivesProjekt()!;
  const heute = heuteIso();
  const jetztKw = isoKw(new Date());
  const kw = kwSchluessel(jetztKw);
  const board = useDaten<BoardEintrag>('board', projekt.id) ?? [];
  const protokolle = useDaten<Protokoll>('protokoll', projekt.id) ?? [];
  const punkte = useDaten<ProtokollPunkt>('protokollpunkt', projekt.id) ?? [];
  const maengel = useDaten<Mangel>('mangel', projekt.id) ?? [];
  const fotos = useDaten<Foto>('foto', projekt.id) ?? [];
  const bautage = useDaten<Bautag>('bautag', projekt.id) ?? [];
  const sync = useSync();

  const dieseWoche = board.filter((e) => e.kw === kw);
  const checkOffen = dieseWoche.reduce((n, e) => n + e.checkpunkte.filter((c) => !c.erledigt).length, 0);
  const heuteTag = wochentagVon(heute);
  const heuteEintraege = dieseWoche.filter((e) => e.wochentag === heuteTag);
  const letztes = letztesProtokoll(protokolle);
  const jfPunkte = letztes ? punkte.filter((p) => p.protokollId === letztes.id) : [];
  const jfOffen = jfPunkte.filter((p) => p.status === 'offen').length;
  const jfUeber = jfPunkte.filter((p) => istUeberfaellig(p, heute)).length;
  const mOffen = maengel.filter((m) => m.status === 'offen');
  const mUeber = mOffen.filter((m) => m.frist && m.frist < heute).length;
  const ohneTags = fotos.filter((f) => istDoku(f) && (!f.gewerk || !f.art)).length;
  const bautagHeute = bautage.find((b) => b.datum === heute);

  return (
    <Seite breit>
      <LinearGradient colors={[farbe.navy, farbe.navyHell]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={s.heroKw}>KW {jetztKw.woche}</Text>
          <Text style={s.heroDatum}>{datumLang(heute)}</Text>
          <Text style={s.heroText} numberOfLines={2}>
            {[projekt.bauherr, projekt.adresse].filter(Boolean).join(' · ') || `Projekt ${projekt.nr}`}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <Badge text={projekt.kiErlaubt ? 'KI an' : 'KI aus'} ton={projekt.kiErlaubt ? 'ok' : 'neutral'} icon={projekt.kiErlaubt ? 'creation' : 'shield-lock'} />
            <Badge
              text={sync.konto ? (sync.konflikte ? `${sync.konflikte} Konflikt(e)` : sync.offen ? `${sync.offen} warten auf Abgleich` : 'OneDrive abgeglichen') : 'OneDrive nicht verbunden'}
              ton={sync.konflikte ? 'rot' : sync.konto && !sync.offen ? 'ok' : 'gelb'}
              icon="cloud-outline"
            />
          </View>
        </View>
        <MaterialCommunityIcons name="hard-hat" size={84} color="rgba(255,255,255,0.14)" />
      </LinearGradient>

      <Raster minBreite={165}>
        <Kennzahl testID="kz-board" wert={dieseWoche.length} label="Einträge diese Woche" icon="view-dashboard" onPress={() => router.push('/board')} />
        <Kennzahl wert={checkOffen} label="Checkpunkte offen" icon="checkbox-marked-outline" ton={checkOffen ? 'akzent' : 'ok'} onPress={() => router.push('/board')} />
        <Kennzahl testID="kz-jf" wert={jfOffen} label={letztes ? `Jour Fixe Nr. ${letztes.nr}: offen` : 'Jour-Fixe-Punkte offen'} icon="clipboard-text" ton="blau" onPress={() => router.push('/jourfixe')} />
        <Kennzahl testID="kz-ueber" wert={jfUeber + mUeber} label="Überfällig (Jour Fixe + Mängel)" icon="alert-circle" ton={jfUeber + mUeber ? 'rot' : 'ok'} onPress={() => router.push(jfUeber ? '/jourfixe' : '/maengel')} />
        <Kennzahl testID="kz-maengel" wert={mOffen.length} label="Mängel offen" icon="alert-octagon-outline" ton={mOffen.length ? 'akzent' : 'ok'} onPress={() => router.push('/maengel')} />
        <Kennzahl wert={ohneTags} label="Fotos ohne Gewerk/Art" icon="tag-off-outline" ton={ohneTags ? 'gelb' : 'ok'} onPress={() => router.push('/fotos')} />
      </Raster>

      <Abschnitt titel={`Heute · ${heuteTag}`}>
        {heuteEintraege.map((e) => (
          <Zeile
            key={e.id}
            icon={e.rubrik === 'Lieferungen' ? 'truck-delivery' : 'calendar-check'}
            ton="akzent"
            titel={e.titel}
            untertitel={`${e.rubrik} · ${e.checkpunkte.filter((c) => c.erledigt).length}/${e.checkpunkte.length} Checkpunkte`}
            onPress={() => router.push({ pathname: '/board/[id]', params: { id: e.id } })}
          />
        ))}
        <Zeile
          testID="start-bautag"
          icon="notebook-edit"
          ton={bautagHeute ? 'ok' : 'navy'}
          titel={bautagHeute ? 'Bautagebuch heute' : 'Bautagebuch: heute eintragen'}
          untertitel={
            bautagHeute
              ? [`${bautagHeute.firmen.reduce((n, f) => n + f.anzahl, 0)} Arbeiter`, wetterText(bautagHeute.wetter)].filter(Boolean).join(' · ')
              : 'Wetter, Firmen und Arbeiter, Notiz'
          }
          onPress={() => router.push({ pathname: '/bautagebuch/[datum]', params: { datum: heute } })}
        />
      </Abschnitt>

      <Abschnitt titel="Alle Bereiche">
        <Raster minBreite={165}>
          <Modul icon="view-dashboard" titel="Wochen-Board" pfad="/board" />
          <Modul icon="camera" titel="Fotos" pfad="/fotos" />
          <Modul icon="clipboard-text" titel="Jour Fixe" pfad="/jourfixe" />
          <Modul testID="modul-bautagebuch" icon="notebook-edit" titel="Bautagebuch" pfad="/bautagebuch" />
          <Modul testID="modul-maengel" icon="alert-octagon-outline" titel="Mängel" pfad="/maengel" />
          <Modul testID="modul-lieferscheine" icon="truck-delivery" titel="Lieferscheine" pfad="/lieferscheine" />
          <Modul testID="modul-unterlagen" icon="file-document-multiple" titel="Unterlagen" pfad="/unterlagen" />
          <Modul testID="modul-firmen" icon="account-hard-hat" titel="Firmen" pfad="/firmen" />
          <Modul testID="modul-suche" icon="magnify" titel="Suche" pfad="/suche" />
        </Raster>
      </Abschnitt>
    </Seite>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', ...schatten },
  heroKw: { color: farbe.weiss, fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  heroDatum: { color: '#E3EAF2', fontSize: groesse.schrift, fontWeight: '700' },
  heroText: { color: '#C2CFDD', fontSize: groesse.schriftKlein + 0.5, lineHeight: 20 },
  modul: {
    minHeight: 104,
    backgroundColor: farbe.karte,
    borderRadius: groesse.radius,
    borderWidth: 1,
    borderColor: farbe.linieLeise,
    padding: 14,
    gap: 10,
    ...schatten,
  },
  modulIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: farbe.navyZart, alignItems: 'center', justifyContent: 'center' },
  modulText: { fontSize: groesse.schrift, fontWeight: '800', color: farbe.text },
});
