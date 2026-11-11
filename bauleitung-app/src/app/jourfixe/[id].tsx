import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { datumDe, heuteIso, plusTage } from '../../domain/datum';
import { ergaenzungFarbe, punktFarbe, punktHinweis, punktNr, sortierePunkte, stichtag, zaehlePunkte } from '../../domain/farblogik';
import type { Firma, Protokoll, ProtokollPunkt } from '../../domain/types';
import { letztesProtokoll } from '../../domain/uebernahme';
import { protokollLoeschen, punktAusKurztext } from '../../dienste/jourfixe';
import { erzeugeProtokollPdf, gibPdfAus } from '../../dienste/pdfAusgabe';
import { neueId } from '../../lib/id';
import { erstelleTermin, MAX_ANHANG_BYTES, parseEmpfaenger, sendeMail } from '../../ms/outlook';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { useDaten, useDatensatz } from '../../state/useDaten';
import { graph, useSync } from '../../sync/dienst';
import { Abschnitt, Badge, Chip, ChipReihe, Feld, Haken, Karte, Knopf, Leer, Reihe, Seite, Text2 } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';
import { Blatt } from '../../ui/Blatt';
import { DatumFeld } from '../../ui/DatumFeld';
import { DiktatKnopf, diktatVerfuegbar } from '../../ui/Diktat';
import { Titel } from '../../ui/Rahmen';
import { farbe, FARBE_PUNKT, groesse } from '../../ui/theme';
import { toast } from '../../ui/toast';
import { zurueck } from '../../ui/navigation';

export default function ProtokollScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useDatensatz<Protokoll>(id);
  if (p === undefined) return <Titel text="Protokoll" zurueckZu="/jourfixe" />;
  if (!p) {
    return (
      <Seite>
        <Titel text="Protokoll" zurueckZu="/jourfixe" />
        <Leer text="Protokoll nicht gefunden." />
      </Seite>
    );
  }
  return <Ansicht key={p.id} protokoll={p} />;
}

function Legende() {
  const zeile = (f: string, text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: f }} />
      <Text style={{ fontSize: groesse.schriftKlein, color: f, fontWeight: '700', flex: 1 }}>{text}</Text>
    </View>
  );
  return (
    <View style={{ gap: 4 }} testID="legende">
      {zeile(farbe.neuBlau, 'Dunkelblau: neu in diesem Protokoll (auch neue Ergänzungen)')}
      {zeile(farbe.text, 'Schwarz: aus einem Vorprotokoll übernommen')}
      {zeile(farbe.rot, 'Rot: Frist überschritten und noch offen')}
    </View>
  );
}

function Ansicht({ protokoll }: { protokoll: Protokoll }) {
  const projekt = useAktivesProjekt();
  const geaendert = useApp((s) => s.geaendert);
  const kiEinst = useApp((s) => s.kiEinst);
  const konto = useSync((s) => s.konto);
  const protokolle = useDaten<Protokoll>('protokoll', protokoll.projektId ?? undefined) ?? [];
  const allePunkte = useDaten<ProtokollPunkt>('protokollpunkt', protokoll.projektId ?? undefined);
  const firmen = useDaten<Firma>('firma', protokoll.projektId ?? undefined) ?? [];
  const [teilnehmer, setTeilnehmer] = useState(protokoll.teilnehmer);
  const [kurz, setKurz] = useState('');
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [mailOffen, setMailOffen] = useState(false);
  const [terminOffen, setTerminOffen] = useState(false);

  const heute = heuteIso();
  const istAktuell = letztesProtokoll(protokolle)?.id === protokoll.id;
  const tag = stichtag(protokoll, { istAktuell, fuerPdf: false, heute });
  const punkte = sortierePunkte((allePunkte ?? []).filter((x) => x.protokollId === protokoll.id), tag);
  const z = zaehlePunkte(punkte, tag);
  const gesperrt = protokoll.status === 'abgeschlossen';

  const aendere = async (a: Partial<Protokoll>) => {
    await holeRepo().aendereAktuell<Protokoll>(protokoll.id, () => a);
    geaendert();
  };

  async function erfasse() {
    const text = kurz.trim();
    if (!text || !projekt) return;
    setLaeuft('Punkt wird erfasst …');
    try {
      const r = await punktAusKurztext({ repo: holeRepo(), projekt, protokoll, text, kiEinst, neueId });
      setKurz('');
      geaendert();
      toast(r.hinweis ?? `Punkt ${punktNr(r.punkt)} erfasst`, { fehler: false });
    } finally {
      setLaeuft(null);
    }
  }

  async function pdf() {
    if (!projekt) return;
    setLaeuft('PDF wird erzeugt …');
    try {
      await aendere({ teilnehmer: teilnehmer.trim() });
      const aktuell = (await holeRepo().holeAktiv<Protokoll>(protokoll.id)) ?? protokoll;
      const datei = await erzeugeProtokollPdf(projekt, aktuell);
      await gibPdfAus(projekt.id, datei);
      toast(konto ? `${datei.name} erstellt – wird in OneDrive unter 03_Protokolle abgelegt` : `${datei.name} erstellt – Ablage in OneDrive folgt nach der Anmeldung`);
    } catch (e) {
      toast(`PDF konnte nicht erzeugt werden: ${e instanceof Error ? e.message : e}`, { fehler: true });
    } finally {
      setLaeuft(null);
    }
  }

  async function loeschen() {
    if (!(await bestaetigen('Protokoll löschen?', `Protokoll Nr. ${protokoll.nr} mit ${punkte.length} Punkt(en) wird gelöscht.`))) return;
    await protokollLoeschen(holeRepo(), protokoll);
    geaendert();
    zurueck('/jourfixe');
  }

  return (
    <Seite>
      <Titel text={`Protokoll Nr. ${protokoll.nr}`} zurueckZu="/jourfixe" />
      <Karte balken={z.ueberfaellig ? farbe.rot : farbe.neuBlau}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={s.titel}>Jour-Fixe-Protokoll Nr. {protokoll.nr}</Text>
          <Badge text={gesperrt ? 'abgeschlossen' : 'Entwurf'} ton={gesperrt ? 'neutral' : 'blau'} />
        </View>
        {projekt ? (
          <Text2 leise>
            {[`${projekt.nr} · ${projekt.name}`, projekt.bauherr, projekt.adresse].filter(Boolean).join('\n')}
          </Text2>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Badge text={`${z.gesamt} Punkte`} />
          <Badge text={`${z.offen} offen`} ton={z.offen ? 'blau' : 'ok'} />
          {z.ueberfaellig ? <Badge text={`${z.ueberfaellig} überfällig`} ton="rot" icon="alert-circle" /> : null}
        </View>
      </Karte>

      <DatumFeld label="Datum" wert={protokoll.datum} onChange={(d) => d && aendere({ datum: d })} testID="jf-datum" />
      <Feld
        label="Teilnehmer"
        value={teilnehmer}
        onChangeText={setTeilnehmer}
        onBlur={() => teilnehmer.trim() !== protokoll.teilnehmer && aendere({ teilnehmer: teilnehmer.trim() })}
        multiline
        editable={!gesperrt}
        placeholder="Namen und Firmen, mit Komma getrennt"
        testID="jf-teilnehmer"
      />

      {!gesperrt ? (
        <Abschnitt titel="Neuer Punkt">
          <Feld
            label={projekt?.kiErlaubt ? 'Kurzeingabe – die KI formuliert Thema und einen sachlichen Satz' : 'Kurzeingabe (KI aus: Text wird unverändert übernommen)'}
            value={kurz}
            onChangeText={setKurz}
            onSubmitEditing={erfasse}
            placeholder="z. B. Estrich 1.OG noch nicht abgeschlossen"
            testID="jf-kurz"
          />
          <Reihe>
            {diktatVerfuegbar ? <DiktatKnopf onText={(t) => setKurz((alt) => (alt.trim() ? `${alt.trim()} ${t}` : t))} /> : null}
            <Knopf titel="Punkt erfassen" icon="plus" onPress={erfasse} deaktiviert={!kurz.trim() || !!laeuft} testID="jf-erfassen" />
          </Reihe>
        </Abschnitt>
      ) : (
        <Text2 leise>Dieses Protokoll ist abgeschlossen. Zum Bearbeiten unten „Wieder öffnen“ wählen.</Text2>
      )}

      <Abschnitt titel="Punkte">
        <Legende />
        {punkte.length === 0 ? <Leer icon="format-list-bulleted" text="Noch keine Punkte erfasst." /> : null}
        {punkte.map((pt) => {
          const f = punktFarbe(pt, protokoll.nr, tag);
          const c = FARBE_PUNKT[f];
          return (
            <Karte
              key={pt.id}
              balken={c}
              testID={`punkt-${punktNr(pt)}`}
              onPress={() => router.push({ pathname: '/jourfixe/punkt/[id]', params: { id: pt.id } })}
            >
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Text style={[s.punktNr, { color: c }]}>{punktNr(pt)}</Text>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[s.thema, { color: c }]} testID="punkt-thema">
                    {pt.thema || '(ohne Thema)'}
                  </Text>
                  <Text style={[s.hinweis, { color: c }]} testID="punkt-hinweis">
                    {punktHinweis(pt, protokoll.nr, tag)}
                  </Text>
                  {pt.beschreibung && pt.beschreibung.trim().toLowerCase() !== pt.thema.trim().toLowerCase() ? <Text style={[s.beschreibung, { color: c }]}>{pt.beschreibung}</Text> : null}
                  {pt.ergaenzungen.map((e) => (
                    <Text key={e.id} style={[s.beschreibung, { color: f === 'rot' ? farbe.rot : FARBE_PUNKT[ergaenzungFarbe(e, protokoll.nr)] }]} testID="punkt-ergaenzung">
                      Ergänzung vom {datumDe(e.datum)}: {e.text}
                    </Text>
                  ))}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {pt.verantwortlich ? <Badge text={pt.verantwortlich} icon="account" /> : null}
                {pt.frist ? <Badge text={`Frist ${datumDe(pt.frist)}`} ton={f === 'rot' ? 'rot' : 'neutral'} icon="calendar" /> : null}
                {pt.fotoIds.length + pt.planausschnittIds.length ? <Badge text={String(pt.fotoIds.length + pt.planausschnittIds.length)} icon="image" /> : null}
                {pt.ki === 'ausstehend' ? <Badge text="KI folgt" ton="gelb" icon="clock-outline" /> : null}
              </View>
              {!gesperrt ? (
                <Haken
                  text="Erledigt"
                  wert={pt.status === 'erledigt'}
                  testID={`erledigt-${punktNr(pt)}`}
                  onChange={async (v) => {
                    await holeRepo().aendereAktuell<ProtokollPunkt>(pt.id, () => ({ status: v ? 'erledigt' : 'offen' }));
                    geaendert();
                  }}
                />
              ) : pt.status === 'erledigt' ? (
                <Badge text="Erledigt" ton="ok" icon="check" />
              ) : null}
            </Karte>
          );
        })}
      </Abschnitt>

      <Abschnitt titel="Ausgabe">
        {laeuft ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <ActivityIndicator color={farbe.navy} />
            <Text2 leise>{laeuft}</Text2>
          </View>
        ) : null}
        <Knopf titel="PDF erzeugen" icon="file-pdf-box" art="navy" onPress={pdf} deaktiviert={!!laeuft} testID="jf-pdf" />
        <Reihe>
          <Knopf titel="Per E-Mail senden" icon="email-fast" art="neben" onPress={() => setMailOffen(true)} testID="jf-mail" />
          <Knopf titel="Nächster Termin" icon="calendar-plus" art="neben" onPress={() => setTerminOffen(true)} testID="jf-termin" />
        </Reihe>
        <Knopf
          titel={gesperrt ? 'Wieder öffnen' : 'Protokoll abschließen'}
          icon={gesperrt ? 'lock-open-variant' : 'lock-check'}
          art="neben"
          onPress={() => aendere({ status: gesperrt ? 'entwurf' : 'abgeschlossen', teilnehmer: teilnehmer.trim() })}
          testID="jf-status"
        />
        <Knopf titel="Protokoll löschen" icon="delete" art="gefahr" onPress={loeschen} testID="jf-loeschen" />
      </Abschnitt>

      {projekt ? (
        <>
          <MailBlatt sichtbar={mailOffen} onSchliessen={() => setMailOffen(false)} protokoll={protokoll} firmen={firmen} />
          <TerminBlatt sichtbar={terminOffen} onSchliessen={() => setTerminOffen(false)} protokoll={protokoll} firmen={firmen} />
        </>
      ) : null}
    </Seite>
  );
}

function OutlookHinweis() {
  const konto = useSync((s) => s.konto);
  if (konto?.outlook) return null;
  return (
    <>
      <Text2 leise>
        {konto
          ? 'Outlook ist für dein Konto noch nicht freigegeben. Schalte unter „Mehr → Microsoft-Konto“ die Outlook-Funktionen ein und melde dich neu an.'
          : 'Dafür musst du bei Microsoft angemeldet sein (Mehr → Microsoft-Konto) und die Outlook-Funktionen einschalten.'}
      </Text2>
      <Knopf titel="Zum Microsoft-Konto" art="leise" icon="microsoft" onPress={() => router.push('/sync')} />
    </>
  );
}

function MailBlatt({ sichtbar, onSchliessen, protokoll, firmen }: { sichtbar: boolean; onSchliessen: () => void; protokoll: Protokoll; firmen: Firma[] }) {
  const projekt = useAktivesProjekt()!;
  const konto = useSync((s) => s.konto);
  const [an, setAn] = useState('');
  const [betreff, setBetreff] = useState(`Jour-Fixe-Protokoll Nr. ${protokoll.nr} – ${projekt.name}`);
  const [text, setText] = useState(`Guten Tag,\n\nanbei das Jour-Fixe-Protokoll Nr. ${protokoll.nr} vom ${datumDe(protokoll.datum)} zum Projekt ${projekt.nr} ${projekt.name}.\n\nMit freundlichen Grüßen\n${konto?.name ?? ''}`);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const mitMail = firmen.filter((f) => f.email);

  async function senden() {
    const { gueltig, ungueltig } = parseEmpfaenger(an);
    if (ungueltig.length) return setFehler(`Keine gültige E-Mail-Adresse: ${ungueltig.join(', ')}`);
    if (!gueltig.length) return setFehler('Bitte mindestens einen Empfänger angeben.');
    setFehler(null);
    setSendet(true);
    try {
      const aktuell = (await holeRepo().holeAktiv<Protokoll>(protokoll.id)) ?? protokoll;
      const pdf = await erzeugeProtokollPdf(projekt, aktuell);
      if (pdf.bytes.length > MAX_ANHANG_BYTES) {
        setFehler('Das PDF ist zu groß für den direkten Versand. Bitte „PDF erzeugen“ wählen und die Datei von dort teilen.');
        return;
      }
      await sendeMail(graph, { an: gueltig, betreff: betreff.trim(), text, anhang: { name: pdf.name, bytes: pdf.bytes, typ: 'application/pdf' } });
      toast(`Protokoll an ${gueltig.length} Empfänger gesendet`);
      onSchliessen();
    } catch (e) {
      setFehler(`Senden fehlgeschlagen: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSendet(false);
    }
  }

  return (
    <Blatt sichtbar={sichtbar} titel="Protokoll per Outlook senden" onSchliessen={onSchliessen}>
      <OutlookHinweis />
      {konto?.outlook ? (
        <>
          <Feld label="An (mehrere Adressen mit Komma trennen)" value={an} onChangeText={setAn} autoCapitalize="none" keyboardType="email-address" testID="mail-an" />
          {mitMail.length ? (
            <ChipReihe>
              {mitMail.map((f) => (
                <Chip key={f.id} titel={f.name} icon="plus" onPress={() => setAn((alt) => (alt.includes(f.email) ? alt : [alt.trim().replace(/,$/, ''), f.email].filter(Boolean).join(', ')))} testID={`mail-firma-${f.name}`} />
              ))}
            </ChipReihe>
          ) : (
            <Text2 leise>Tipp: Unter „Firmen“ hinterlegte E-Mail-Adressen erscheinen hier zum Antippen.</Text2>
          )}
          <Feld label="Betreff" value={betreff} onChangeText={setBetreff} testID="mail-betreff" />
          <Feld label="Text" value={text} onChangeText={setText} multiline testID="mail-text" />
          <Text2 leise>Anhang: das aktuelle PDF des Protokolls. Gesendet wird von {konto.email || 'deinem Konto'}; die Mail liegt danach in „Gesendete Elemente“.</Text2>
          {fehler ? <Text2 farbeText={farbe.rot} fett>{fehler}</Text2> : null}
          {sendet ? <ActivityIndicator color={farbe.navy} /> : <Knopf titel="Senden" icon="send" onPress={senden} testID="mail-senden" />}
        </>
      ) : null}
    </Blatt>
  );
}

function TerminBlatt({ sichtbar, onSchliessen, protokoll, firmen }: { sichtbar: boolean; onSchliessen: () => void; protokoll: Protokoll; firmen: Firma[] }) {
  const projekt = useAktivesProjekt()!;
  const konto = useSync((s) => s.konto);
  const [datum, setDatum] = useState(plusTage(protokoll.datum, 7));
  const [beginn, setBeginn] = useState('09:00');
  const [dauer, setDauer] = useState('60');
  const [ort, setOrt] = useState(projekt.adresse);
  const [teilnehmer, setTeilnehmer] = useState('');
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const mitMail = firmen.filter((f) => f.email);

  async function anlegen() {
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(beginn.trim())) return setFehler('Bitte die Uhrzeit als HH:MM angeben, z. B. 09:00.');
    const minuten = Number(dauer);
    if (!Number.isFinite(minuten) || minuten <= 0) return setFehler('Bitte die Dauer in Minuten angeben.');
    const { gueltig, ungueltig } = parseEmpfaenger(teilnehmer);
    if (ungueltig.length) return setFehler(`Keine gültige E-Mail-Adresse: ${ungueltig.join(', ')}`);
    setFehler(null);
    setSendet(true);
    try {
      await erstelleTermin(graph, {
        betreff: `Jour Fixe Nr. ${protokoll.nr + 1} – ${projekt.name}`,
        datum,
        beginn: beginn.trim(),
        dauerMinuten: minuten,
        ort: ort.trim(),
        text: `Jour Fixe zum Projekt ${projekt.nr} ${projekt.name}.`,
        teilnehmer: gueltig,
      });
      toast(gueltig.length ? `Termin eingetragen, ${gueltig.length} Einladung(en) verschickt` : 'Termin in deinen Outlook-Kalender eingetragen');
      onSchliessen();
    } catch (e) {
      setFehler(`Termin konnte nicht eingetragen werden: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSendet(false);
    }
  }

  return (
    <Blatt sichtbar={sichtbar} titel="Nächsten Jour Fixe in Outlook eintragen" onSchliessen={onSchliessen}>
      <OutlookHinweis />
      {konto?.outlook ? (
        <>
          <DatumFeld label="Datum" wert={datum} onChange={(d) => d && setDatum(d)} testID="termin-datum" />
          <Reihe>
            <Feld label="Beginn (HH:MM)" value={beginn} onChangeText={setBeginn} keyboardType="numbers-and-punctuation" testID="termin-beginn" />
            <Feld label="Dauer (Minuten)" value={dauer} onChangeText={setDauer} keyboardType="number-pad" testID="termin-dauer" />
          </Reihe>
          <Feld label="Ort" value={ort} onChangeText={setOrt} testID="termin-ort" />
          <Feld label="Einladen (E-Mail-Adressen, optional)" value={teilnehmer} onChangeText={setTeilnehmer} autoCapitalize="none" keyboardType="email-address" testID="termin-teilnehmer" />
          {mitMail.length ? (
            <ChipReihe>
              {mitMail.map((f) => (
                <Chip key={f.id} titel={f.name} icon="plus" onPress={() => setTeilnehmer((alt) => (alt.includes(f.email) ? alt : [alt.trim().replace(/,$/, ''), f.email].filter(Boolean).join(', ')))} />
              ))}
            </ChipReihe>
          ) : null}
          {fehler ? <Text2 farbeText={farbe.rot} fett>{fehler}</Text2> : null}
          {sendet ? <ActivityIndicator color={farbe.navy} /> : <Knopf titel="Termin eintragen" icon="calendar-check" onPress={anlegen} testID="termin-anlegen" />}
        </>
      ) : null}
    </Blatt>
  );
}

const s = StyleSheet.create({
  titel: { flex: 1, fontSize: 20, fontWeight: '800', color: farbe.text },
  punktNr: { fontSize: groesse.schrift, fontWeight: '800', minWidth: 44 },
  thema: { fontSize: groesse.schrift + 1, fontWeight: '800', lineHeight: 23 },
  hinweis: { fontSize: 12.5, fontWeight: '700' },
  beschreibung: { fontSize: groesse.schriftKlein + 1, lineHeight: 21 },
});
