import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { farbe, groesse } from './theme';

/** Auswahlblatt, das von unten eingeblendet wird. */
export function Blatt({
  sichtbar,
  titel,
  onSchliessen,
  children,
}: {
  sichtbar: boolean;
  titel: string;
  onSchliessen: () => void;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={sichtbar} transparent animationType="slide" onRequestClose={onSchliessen}>
      <View style={s.huelle}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onSchliessen} accessibilityLabel="Schließen" />
        <View style={[s.blatt, { paddingBottom: insets.bottom + 16 }]} testID="blatt">
          <View style={s.kopf}>
            <Text style={s.titel}>{titel}</Text>
            <Pressable onPress={onSchliessen} accessibilityRole="button" accessibilityLabel="Schließen" hitSlop={10} testID="blatt-schliessen">
              <MaterialCommunityIcons name="close" size={26} color={farbe.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  huelle: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', backgroundColor: 'rgba(11, 18, 32, 0.45)' },
  blatt: {
    backgroundColor: farbe.karte,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 720,
    gap: 12,
  },
  kopf: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titel: { fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.text },
});
