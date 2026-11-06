import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { kwText, kwTextAusSchluessel } from '../domain/kw';
import { analysiere } from '../domain/schnellerfassung';
import type { BoardEintrag, Foto, ProtokollPunkt } from '../domain/types';
import { erfasse, ErfassungFehler, rueckgaengig, type ErfassungErgebnis } from '../dienste/erfassung';
import { fotoAufnehmen, type NeuesBild } from '../foto/aufnahme';
import { loescheBild } from '../foto/dateien';
import { neueId } from '../lib/id';
import { holeRepo, useAktivesProjekt, useApp } from '../state/useApp';
import { Chip, ChipReihe, Knopf, Seite, Text2 } from '../ui/bausteine';
import { Bild } from '../ui/Bild';
import { DiktatKnopf, diktatVerfuegbar } from '../ui/Diktat';
import { MitProjekt } from '../ui/Rahmen';
import { farbe, groesse } from '../ui/theme';

export default function ErfassenScreen() {
  return (
    <MitProjekt>
      <Erfassen />
    </MitProjekt>
  );
}

function bearbeitenPfad(r: ErfassungErgebnis) {
  switch (r.haupt.typ) {
    case 'board':
      return { pathname: '/board/[id]' as const, params: { id: r.haupt.id } };
    case 'protokollpunkt':
      return { pathname: '/jourfixe/punkt/[id]' as const, params: { id: r.haupt.id } };
    default:
      return { pathname: '/fotos/[id]' as const, params: { id: r.haupt.id } };
  }
}

function Erfassen() {
  const projekt = useAktivesProjekt()!;
  const kiEinst = useApp((s) => s.kiEinst);
  const geaendert = useApp((s) => s.geaendert);
  const nachholen = useApp((s) => s.nachholen);
  const [text, setText] = useState('');
  const [bild, setBild] = useState<NeuesBild | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<ErfassungErgebnis | null>(null);
  const eingabe = useRef<TextInputInstance>(null);

  const a = useMemo(() => analysiere(text), [text]);

  async function foto() {
    setFehler(null);
    try {
      const b = await fotoAufnehmen();
      if (b) {
        if (bild) await loescheBild(bild.datei);
        setBild(b);
      }
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Foto konnte nicht aufgenommen werden.');
    }
  }

  async function fotoEntfernen() {
    if (bild) await loescheBild(bild.datei);
    setBild(null);
  }

  async function absenden() {
    setFehler(null);
    setLaeuft(true);
    try {
      const r = await erfasse({ repo: holeRepo(), projekt, kiEinst, neueId }, { text, bild });
      setErgebnis(r);
      if (r.haupt.typ === 'board') useApp.setState({ boardKw: (r.haupt as BoardEintrag).kw });
      setText('');
      setBild(null);
      geaendert();
      nachholen().catch(() => {});
    } catch (e) {
      setFehler(e instanceof ErfassungFehler ? e.message : 'Speichern fehlgeschlagen.');
    } finally {
      setLaeuft(false);
    }
  }

  async function zuruecknehmen() {
    if (!ergebnis) return;
    await rueckgaengig(holeRepo(), ergebnis.erstellt, loescheBild);
    geaendert();
    setErgebnis(null);
    setFehler('Erfassung rückgängig gemacht.');
  }

  if (ergebnis) {
    return (
      <Seite>
        <View style={s.ergebnis} testID="erfassung-ergebnis">
          <MaterialCommunityIcons name="check-circle" size={40} color={farbe.ok} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.ergebnisTitel}>{titelVon(ergebnis)}</Text>
            <Text style={s.ergebnisText}>→ {ergebnis.zusammenfassung}</Text>
          </View>
        </View>
        {ergebnis.hinweis ? <Text2 leise>{ergebnis.hinweis}</Text2> : null}
        <View style={s.reihe}>
          <View style={{ flex: 1 }}>
            <Knopf titel="Rückgängig" art="gefahr" icon="undo" onPress={zuruecknehmen} testID="rueckgaengig" />
          </View>
          <View style={{ flex: 1 }}>
            <Knopf
              titel="Bearbeiten"
              art="neben"
              icon="pencil"
              onPress={() => router.replace(bearbeitenPfad(ergebnis))}
              testID="bearbeiten"
            />
          </View>
        </View>
        <Knopf
          titel="Nächste Erfassung"
          icon="plus"
          onPress={() => {
            setErgebnis(null);
            setTimeout(() => eingabe.current?.focus(), 50);
          }}
          testID="naechste"
        />
        <Knopf titel="Fertig" art="neben" onPress={() => router.back()} />
      </Seite>
    );
  }

  const ziel = a.jf ? 'Jour Fixe' : !a.text && bild ? 'nur Foto' : projekt.kiErlaubt ? 'KI entscheidet' : 'Board';

  return (
    <Seite>
      <TextInput
        ref={eingabe}
        testID="erfassen-text"
        accessibilityLabel="Kurztext"
        value={text}
        onChangeText={setText}
        placeholder="z. B. kw40 Estrich 1.OG · Donnerstag Lieferung Trockenbau · jf Brandschutz klären"
        placeholderTextColor={farbe.textLeise}
        multiline
        autoFocus
        style={s.eingabe}
      />
      <ChipReihe>
        <Chip titel={`Ziel: ${ziel}`} />
        {a.kw ? <Chip titel={kwText(a.kw)} aktiv /> : null}
        {a.wochentag ? <Chip titel={a.wochentag} aktiv /> : null}
        {projekt.kiErlaubt ? <Chip titel="KI an" /> : <Chip titel="KI aus" />}
      </ChipReihe>
      {a.kwFehler ? <Text style={s.fehler}>{a.kwFehler}</Text> : null}

      <View style={s.reihe}>
        {diktatVerfuegbar ? (
          <View style={{ flex: 1 }}>
            <DiktatKnopf onText={(t) => setText((alt) => (alt.trim() ? `${alt.trim()} ${t}` : t))} />
          </View>
        ) : null}
        <Pressable
          testID="foto-knopf"
          accessibilityRole="button"
          accessibilityLabel="Foto aufnehmen"
          onPress={foto}
          style={({ pressed }) => [s.fotoKnopf, pressed && { opacity: 0.7 }]}
        >
          <MaterialCommunityIcons name="camera" size={34} color={farbe.weiss} />
          <Text style={s.fotoText}>Foto</Text>
        </Pressable>
      </View>

      {bild ? (
        <View style={s.vorschau}>
          <Bild datei={bild.datei} vorschau={bild.vorschau} style={s.vorschauBild} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text2>{`Foto · ${kwTextAusSchluessel(bild.kw)}`}</Text2>
            <Knopf titel="Foto entfernen" art="neben" onPress={fotoEntfernen} />
          </View>
        </View>
      ) : null}

      {fehler ? <Text style={s.fehler}>{fehler}</Text> : null}

      {laeuft ? (
        <ActivityIndicator size="large" color={farbe.navy} />
      ) : (
        <Knopf titel="Erfassen" icon="check-bold" onPress={absenden} testID="erfassen-absenden" />
      )}
      <Text2 leise>
        „kw40“ legt den Eintrag in KW 40 (fehlt die Woche, wird sie angelegt). „jf“ am Anfang: Punkt fürs
        Jour-Fixe-Protokoll. Ein Wochentag im Text wird markiert.
      </Text2>
    </Seite>
  );
}

function titelVon(r: ErfassungErgebnis): string {
  switch (r.haupt.typ) {
    case 'board':
      return (r.haupt as BoardEintrag).titel;
    case 'protokollpunkt':
      return (r.haupt as ProtokollPunkt).thema;
    default:
      return (r.haupt as Foto).notiz || 'Foto gespeichert';
  }
}

const s = StyleSheet.create({
  eingabe: {
    minHeight: 120,
    borderWidth: 2,
    borderColor: farbe.linie,
    borderRadius: groesse.radius,
    padding: 14,
    fontSize: groesse.schriftGross,
    color: farbe.text,
    textAlignVertical: 'top',
    backgroundColor: farbe.hintergrund,
  },
  reihe: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  fotoKnopf: {
    minHeight: 72,
    minWidth: 120,
    borderRadius: groesse.radius,
    backgroundColor: farbe.navy,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  fotoText: { color: farbe.weiss, fontSize: groesse.schriftGross, fontWeight: '800' },
  vorschau: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  vorschauBild: { width: 110, height: 110, borderRadius: groesse.radius, borderWidth: 2, borderColor: farbe.linie },
  fehler: { color: farbe.rot, fontSize: groesse.schrift, fontWeight: '700' },
  ergebnis: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderWidth: 3,
    borderColor: farbe.ok,
    borderRadius: groesse.radius,
    padding: 16,
  },
  ergebnisTitel: { fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.text },
  ergebnisText: { fontSize: groesse.schrift, color: farbe.text, fontWeight: '600' },
});
