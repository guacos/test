import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native';
import { kwText, kwTextAusSchluessel } from '../domain/kw';
import { analysiere } from '../domain/schnellerfassung';
import type { BoardEintrag, Foto, ProtokollPunkt } from '../domain/types';
import { erfasse, ErfassungFehler, rueckgaengig, type ErfassungErgebnis } from '../dienste/erfassung';
import { bildWaehlen, fotoAufnehmen, kameraVerfuegbar, type NeuesBild } from '../foto/aufnahme';
import { loescheBild } from '../foto/dateien';
import { neueId } from '../lib/id';
import { holeRepo, useAktivesProjekt, useApp } from '../state/useApp';
import { Badge, Knopf, Reihe, Seite, Text2 } from '../ui/bausteine';
import { Bild } from '../ui/Bild';
import { DiktatKnopf, diktatVerfuegbar } from '../ui/Diktat';
import { MitProjekt } from '../ui/Rahmen';
import { farbe, groesse, schatten } from '../ui/theme';

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
      const b = kameraVerfuegbar ? await fotoAufnehmen() : await bildWaehlen();
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
          <View style={s.ergebnisIcon}>
            <MaterialCommunityIcons name="check-bold" size={30} color={farbe.weiss} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.ergebnisTitel}>{titelVon(ergebnis)}</Text>
            <Text style={s.ergebnisText}>→ {ergebnis.zusammenfassung}</Text>
          </View>
        </View>
        {ergebnis.hinweis ? <Text2 leise>{ergebnis.hinweis}</Text2> : null}
        <Reihe>
          <Knopf titel="Rückgängig" art="gefahr" icon="undo" onPress={zuruecknehmen} testID="rueckgaengig" />
          <Knopf titel="Bearbeiten" art="neben" icon="pencil" onPress={() => router.replace(bearbeitenPfad(ergebnis))} testID="bearbeiten" />
        </Reihe>
        <Knopf
          titel="Nächste Erfassung"
          icon="plus"
          onPress={() => {
            setErgebnis(null);
            setTimeout(() => eingabe.current?.focus(), 50);
          }}
          testID="naechste"
        />
        <Knopf titel="Fertig" art="neben" onPress={() => router.back()} testID="erfassen-fertig" />
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
        placeholder="z. B. kw40 Estrich 1.OG"
        placeholderTextColor="#7A8492"
        multiline
        autoFocus
        style={s.eingabe}
      />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Badge text={`Ziel: ${ziel}`} ton="navy" icon="arrow-right-bold" />
        {a.kw ? <Badge text={kwText(a.kw)} ton="akzent" icon="calendar-week" /> : null}
        {a.wochentag ? <Badge text={a.wochentag} ton="akzent" icon="calendar" /> : null}
        <Badge text={projekt.kiErlaubt ? 'KI an' : 'KI aus'} ton={projekt.kiErlaubt ? 'ok' : 'neutral'} />
      </View>
      {a.kwFehler ? <Text style={s.fehler}>{a.kwFehler}</Text> : null}

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        {diktatVerfuegbar ? (
          <View style={{ flex: 1 }}>
            <DiktatKnopf onText={(t) => setText((alt) => (alt.trim() ? `${alt.trim()} ${t}` : t))} />
          </View>
        ) : null}
        <Pressable
          testID="foto-knopf"
          accessibilityRole="button"
          accessibilityLabel={kameraVerfuegbar ? 'Foto aufnehmen' : 'Bild auswählen'}
          onPress={foto}
          style={({ pressed }) => [s.fotoKnopf, pressed && { opacity: 0.75 }]}
        >
          <MaterialCommunityIcons name={kameraVerfuegbar ? 'camera' : 'image-plus'} size={32} color={farbe.weiss} />
          <Text style={s.fotoText}>{kameraVerfuegbar ? 'Foto' : 'Bild'}</Text>
        </Pressable>
      </View>

      {bild ? (
        <View style={s.vorschau}>
          <Bild datei={bild.datei} vorschau={bild.vorschau} style={s.vorschauBild} />
          <View style={{ flex: 1, gap: 8 }}>
            <Text2 fett>{`Foto · ${kwTextAusSchluessel(bild.kw)}`}</Text2>
            <Knopf titel="Foto entfernen" art="neben" klein onPress={fotoEntfernen} />
          </View>
        </View>
      ) : null}

      {fehler ? <Text style={s.fehler}>{fehler}</Text> : null}

      {laeuft ? <ActivityIndicator size="large" color={farbe.navy} /> : <Knopf titel="Erfassen" icon="check-bold" onPress={absenden} testID="erfassen-absenden" />}

      <View style={s.hilfe}>
        <Text style={s.hilfeZeile}>
          <Text style={s.hilfeCode}>kw40 …</Text> legt den Eintrag in KW 40 (fehlt die Woche, wird sie angelegt)
        </Text>
        <Text style={s.hilfeZeile}>
          <Text style={s.hilfeCode}>jf …</Text> am Anfang: Punkt fürs Jour-Fixe-Protokoll
        </Text>
        <Text style={s.hilfeZeile}>
          <Text style={s.hilfeCode}>Donnerstag …</Text> ein Wochentag im Text wird markiert
        </Text>
      </View>
    </Seite>
  );
}

const s = StyleSheet.create({
  eingabe: {
    minHeight: 130,
    borderWidth: 2,
    borderColor: farbe.navy,
    borderRadius: groesse.radius,
    padding: 16,
    fontSize: groesse.schriftGross + 1,
    color: farbe.text,
    textAlignVertical: 'top',
    backgroundColor: farbe.karte,
    ...schatten,
  },
  fotoKnopf: {
    minHeight: 72,
    borderRadius: groesse.radius,
    backgroundColor: farbe.navy,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    flex: 1,
  },
  fotoText: { color: farbe.weiss, fontSize: groesse.schriftGross, fontWeight: '800' },
  vorschau: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  vorschauBild: { width: 110, height: 110, borderRadius: groesse.radius },
  fehler: { color: farbe.rot, fontSize: groesse.schrift, fontWeight: '700' },
  ergebnis: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: farbe.okZart,
    borderWidth: 1.5,
    borderColor: farbe.ok,
    borderRadius: groesse.radius,
    padding: 16,
  },
  ergebnisIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: farbe.ok, alignItems: 'center', justifyContent: 'center' },
  ergebnisTitel: { fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.text },
  ergebnisText: { fontSize: groesse.schrift, color: farbe.text, fontWeight: '700' },
  hilfe: { gap: 6, backgroundColor: farbe.navyZart, borderRadius: groesse.radius, padding: 14 },
  hilfeZeile: { fontSize: groesse.schriftKlein + 0.5, color: farbe.text, lineHeight: 21 },
  hilfeCode: { fontWeight: '800', color: farbe.navy },
});
