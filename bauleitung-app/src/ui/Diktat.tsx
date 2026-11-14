/**
 * Diktat (Android): Spracherkennung NUR auf dem Gerät (requiresOnDeviceRecognition),
 * damit keine Audiodaten an Google geschickt werden. Voraussetzung: deutsches
 * Offline-Sprachpaket ist installiert (wird bei Bedarf angeboten).
 */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { farbe, groesse } from './theme';

export function DiktatKnopf({ onText }: { onText: (text: string) => void }) {
  const [aktiv, setAktiv] = useState(false);
  const [zwischen, setZwischen] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [paketFehlt, setPaketFehlt] = useState(false);
  const letzter = useRef('');

  useSpeechRecognitionEvent('start', () => setAktiv(true));
  useSpeechRecognitionEvent('end', () => {
    setAktiv(false);
    setZwischen('');
  });
  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      if (t && t !== letzter.current) onText(t);
      letzter.current = t;
      setZwischen('');
    } else {
      setZwischen(t);
    }
  });
  useSpeechRecognitionEvent('error', (e) => {
    setAktiv(false);
    if (e.error === 'language-not-supported' || e.error === 'service-not-allowed') {
      setPaketFehlt(true);
      setFehler('Offline-Spracherkennung für Deutsch ist nicht installiert.');
    } else if (e.error === 'no-speech' || e.error === 'speech-timeout') {
      setFehler('Nichts verstanden – bitte noch einmal.');
    } else if (e.error !== 'aborted') {
      setFehler(`Diktat nicht möglich (${e.error}).`);
    }
  });

  async function start() {
    setFehler(null);
    if (aktiv) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    const recht = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!recht.granted) {
      setFehler('Kein Zugriff auf das Mikrofon. Bitte in den Einstellungen erlauben.');
      return;
    }
    if (!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
      setPaketFehlt(true);
      setFehler('Dieses Gerät bietet keine Offline-Spracherkennung an.');
      return;
    }
    letzter.current = '';
    ExpoSpeechRecognitionModule.start({
      lang: 'de-DE',
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: true,
      addsPunctuation: false,
    });
  }

  async function paketLaden() {
    try {
      const r = await ExpoSpeechRecognitionModule.androidTriggerOfflineModelDownload({ locale: 'de-DE' });
      setFehler(r.status === 'download_success' ? 'Sprachpaket installiert – bitte erneut diktieren.' : 'Bitte den Download im Dialog bestätigen.');
      setPaketFehlt(false);
    } catch {
      setFehler('Download nicht möglich. Bitte in den Android-Einstellungen unter Spracherkennung „Deutsch“ offline laden.');
    }
  }

  return (
    <View style={{ gap: 6 }}>
      <Pressable
        testID="diktat-knopf"
        accessibilityRole="button"
        accessibilityLabel={aktiv ? 'Diktat beenden' : 'Diktat starten'}
        onPress={start}
        style={({ pressed }) => [s.knopf, aktiv && s.aktiv, pressed && { opacity: 0.7 }]}
      >
        <MaterialCommunityIcons name={aktiv ? 'stop' : 'microphone'} size={34} color={farbe.weiss} />
        <Text style={s.text}>{aktiv ? 'Stopp' : 'Diktat'}</Text>
      </Pressable>
      {zwischen ? <Text style={s.zwischen}>„{zwischen}“</Text> : null}
      {fehler ? <Text style={s.fehler}>{fehler}</Text> : null}
      {paketFehlt ? (
        <Pressable onPress={paketLaden} style={s.link} accessibilityRole="button">
          <Text style={s.linkText}>Deutsches Offline-Sprachpaket laden</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export const diktatVerfuegbar = true;

const s = StyleSheet.create({
  knopf: {
    minHeight: 72,
    borderRadius: groesse.radius,
    backgroundColor: farbe.navy,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  aktiv: { backgroundColor: farbe.rot },
  text: { color: farbe.weiss, fontSize: groesse.schriftGross, fontWeight: '800' },
  zwischen: { fontSize: groesse.schrift, color: farbe.textLeise, fontStyle: 'italic' },
  fehler: { fontSize: groesse.schriftKlein, color: farbe.rot, fontWeight: '700' },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: groesse.schrift, color: farbe.navy, textDecorationLine: 'underline', fontWeight: '700' },
});
