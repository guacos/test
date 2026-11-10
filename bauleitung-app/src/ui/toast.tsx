import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { farbe, groesse, schattenStark } from './theme';

interface ToastState {
  text: string | null;
  fehler: boolean;
  aktion: { titel: string; onPress: () => void } | null;
  nr: number;
}

const useToast = create<ToastState>(() => ({ text: null, fehler: false, aktion: null, nr: 0 }));
let timer: ReturnType<typeof setTimeout> | null = null;

/** Kurze Rückmeldung am unteren Rand, optional mit Aktion (z. B. "Rückgängig"). */
export function toast(text: string, opt: { fehler?: boolean; aktion?: { titel: string; onPress: () => void }; dauerMs?: number } = {}) {
  if (timer) clearTimeout(timer);
  useToast.setState((s) => ({ text, fehler: !!opt.fehler, aktion: opt.aktion ?? null, nr: s.nr + 1 }));
  timer = setTimeout(() => useToast.setState({ text: null, aktion: null }), opt.dauerMs ?? (opt.aktion ? 6000 : 3200));
}

export function ToastAnzeige() {
  const { text, fehler, aktion } = useToast();
  const insets = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View pointerEvents="box-none" style={[s.huelle, { bottom: insets.bottom + 96 }]}>
      <View testID="toast" style={[s.toast, fehler && { backgroundColor: farbe.rot }]}>
        <MaterialCommunityIcons name={fehler ? 'alert-circle' : 'check-circle'} size={22} color={farbe.weiss} />
        <Text style={s.text}>{text}</Text>
        {aktion ? (
          <Pressable
            testID="toast-aktion"
            accessibilityRole="button"
            onPress={() => {
              aktion.onPress();
              useToast.setState({ text: null, aktion: null });
            }}
            hitSlop={10}
          >
            <Text style={s.aktion}>{aktion.titel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  huelle: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: farbe.navy,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    maxWidth: 560,
    ...schattenStark,
  },
  text: { color: farbe.weiss, fontSize: groesse.schriftKlein + 1.5, fontWeight: '600', flexShrink: 1 },
  aktion: { color: '#FFD9C2', fontSize: groesse.schrift, fontWeight: '800', marginLeft: 6 },
});
