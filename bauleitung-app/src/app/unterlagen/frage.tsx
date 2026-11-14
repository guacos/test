import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { Unterlage } from '../../domain/types';
import { groesseText, MAX_FRAGE_BYTES, planText, veralteteIds } from '../../domain/unterlagen';
import { frageUnterlagen } from '../../dienste/unterlagen';
import type { KiFrageAntwort } from '../../ki/client';
import { useAktivesProjekt, useApp } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Abschnitt, Badge, Feld, Haken, Karte, Knopf, Leer, Seite, Text2 } from '../../ui/bausteine';
import { DiktatKnopf, diktatVerfuegbar } from '../../ui/Diktat';
import { MitProjekt, Titel } from '../../ui/Rahmen';
import { farbe, groesse } from '../../ui/theme';

export default function FrageScreen() {
  return (
    <>
      <Titel text="Frage an die Unterlagen" zurueckZu="/unterlagen" />
      <MitProjekt>
        <Assistent />
      </MitProjekt>
    </>
  );
}

interface Eintrag {
  frage: string;
  antwort: KiFrageAntwort | null;
  fehler: string | null;
  dokumente: string[];
}

function Assistent() {
  const projekt = useAktivesProjekt()!;
  const kiEinst = useApp((s) => s.kiEinst);
  const unterlagen = useDaten<Unterlage>('unterlage', projekt.id);
  const [frage, setFrage] = useState('');
  const [gewaehlt, setGewaehlt] = useState<Set<string> | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [verlauf, setVerlauf] = useState<Eintrag[]>([]);

  const alt = useMemo(() => veralteteIds(unterlagen ?? []), [unterlagen]);
  // Nur PDFs im aktuellen Stand kommen in Frage
  const moeglich = useMemo(() => (unterlagen ?? []).filter((u) => u.mime === 'application/pdf' && !alt.has(u.id)), [unterlagen, alt]);
  const veraltet = (unterlagen ?? []).filter((u) => u.mime === 'application/pdf' && alt.has(u.id));

  useEffect(() => {
    if (gewaehlt === null && unterlagen) setGewaehlt(new Set(moeglich.map((u) => u.id)));
  }, [unterlagen, moeglich, gewaehlt]);

  if (!unterlagen) return null;
  const auswahl = moeglich.filter((u) => gewaehlt?.has(u.id));
  const summe = auswahl.reduce((n, u) => n + (u.groesse ?? 0), 0);
  const zuGross = summe > MAX_FRAGE_BYTES;

  async function stelle() {
    const text = frage.trim();
    if (text.length < 3 || !auswahl.length) return;
    setLaeuft(true);
    const eintrag: Eintrag = { frage: text, antwort: null, fehler: null, dokumente: auswahl.map((u) => u.name) };
    try {
      eintrag.antwort = await frageUnterlagen({ frage: text, unterlagen: auswahl, kiEinst });
      setFrage('');
    } catch (e) {
      eintrag.fehler = e instanceof Error ? e.message : 'Die Frage konnte nicht beantwortet werden.';
    } finally {
      setVerlauf((v) => [eintrag, ...v]);
      setLaeuft(false);
    }
  }

  if (!projekt.kiErlaubt) {
    return (
      <Seite>
        <Leer icon="shield-lock" text="In diesem Projekt ist die KI ausgeschaltet – es verlässt nichts das Gerät und dein OneDrive. Für Fragen an die Unterlagen müsstest du im Projekt „KI erlaubt“ einschalten. Dann werden die ausgewählten PDFs zur Beantwortung an die KI geschickt.">
          <Knopf titel="Projekt bearbeiten" art="neben" onPress={() => router.push({ pathname: '/projekte/[id]', params: { id: projekt.id } })} />
        </Leer>
      </Seite>
    );
  }

  return (
    <Seite>
      <Text2 leise>
        Die KI antwortet nur anhand der ausgewählten Unterlagen und nennt immer die Quelle (Dokument, Seite). Findet sie nichts Eindeutiges, lautet die Antwort „Weiß ich
        nicht – nicht in den Unterlagen gefunden.“ Bitte prüfe Zahlen aus Plänen an der genannten Stelle nach.
      </Text2>
      <Feld label="Deine Frage" value={frage} onChangeText={setFrage} multiline placeholder="z. B. Wie viele Stahltüren sind in der Halle?" testID="frage-feld" />
      {diktatVerfuegbar ? <DiktatKnopf onText={(t) => setFrage((a) => (a.trim() ? `${a.trim()} ${t}` : t))} /> : null}
      {laeuft ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <ActivityIndicator color={farbe.navy} />
          <Text2 leise>Die Unterlagen werden gelesen – das kann bei großen Plänen ein bis zwei Minuten dauern …</Text2>
        </View>
      ) : (
        <Knopf titel="Frage stellen" icon="send" onPress={stelle} deaktiviert={frage.trim().length < 3 || !auswahl.length || zuGross} testID="frage-senden" />
      )}

      {verlauf.map((e, i) => (
        <Karte key={verlauf.length - i} balken={e.fehler ? farbe.rot : e.antwort?.gefunden ? farbe.ok : farbe.gelb} testID="antwort">
          <Text style={{ fontSize: groesse.schriftKlein + 1, fontWeight: '800', color: farbe.textLeise }}>{e.frage}</Text>
          {e.fehler ? (
            <Text2 farbeText={farbe.rot} fett>
              {e.fehler}
            </Text2>
          ) : (
            <Text style={{ fontSize: groesse.schrift + 1, lineHeight: 26, color: farbe.text, fontWeight: e.antwort?.gefunden ? '400' : '800' }} testID="antwort-text">
              {e.antwort?.antwort}
            </Text>
          )}
          {e.antwort?.quellen.map((q, n) => {
            const u = unterlagen.find((x) => x.name === q.dokument);
            return (
              <View key={n} style={{ gap: 4, borderTopWidth: 1, borderTopColor: farbe.linieLeise, paddingTop: 8 }} testID="quelle">
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Badge text={`Quelle: ${q.dokument}, Seite ${q.seiteVon}${q.seiteBis > q.seiteVon ? `–${q.seiteBis}` : ''}`} ton="navy" icon="file-search-outline" />
                  {u && planText(u) ? <Badge text={planText(u)} /> : null}
                  {u ? <Knopf titel="Öffnen" klein art="leise" onPress={() => router.push({ pathname: '/unterlagen/[id]', params: { id: u.id } })} /> : null}
                </View>
                <Text style={{ fontSize: groesse.schriftKlein, color: farbe.textLeise, fontStyle: 'italic', lineHeight: 20 }}>„{q.zitat}“</Text>
              </View>
            );
          })}
          {!e.fehler ? <Text style={{ fontSize: 12.5, color: farbe.textLeise }}>Durchsucht: {e.dokumente.join(', ')}</Text> : null}
        </Karte>
      ))}

      <Abschnitt titel={`Durchsuchte Unterlagen (${auswahl.length} von ${moeglich.length}${summe ? `, ${groesseText(summe)}` : ''})`}>
        {moeglich.length === 0 ? <Text2 leise>Es gibt noch keine PDF-Unterlagen. Füge unter „Unterlagen“ Dateien hinzu.</Text2> : null}
        {zuGross ? (
          <Text2 farbeText={farbe.rot} fett>
            Die Auswahl ist zu groß (höchstens {groesseText(MAX_FRAGE_BYTES)} je Frage). Bitte Dokumente abwählen.
          </Text2>
        ) : null}
        {moeglich.map((u) => (
          <Haken
            key={u.id}
            testID={`frage-dok-${u.name}`}
            text={[u.name, planText(u), groesseText(u.groesse)].filter(Boolean).join(' · ')}
            wert={!!gewaehlt?.has(u.id)}
            ohneStrich
            onChange={(v) =>
              setGewaehlt((alt2) => {
                const s = new Set(alt2);
                if (v) s.add(u.id);
                else s.delete(u.id);
                return s;
              })
            }
          />
        ))}
        {veraltet.length ? (
          <Text2 leise>Nicht verwendet, weil es einen neueren Index gibt: {veraltet.map((u) => `${u.name} (${planText(u)})`).join(', ')}</Text2>
        ) : null}
      </Abschnitt>
    </Seite>
  );
}
