import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from 'react-native';
import { farbe, groesse } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Scrollbarer Inhalt mit Seitenrand, auf breiten Bildschirmen zentriert. */
export function Seite({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={s.seite} contentContainerStyle={s.seiteInhalt} keyboardShouldPersistTaps="handled">
      <View style={s.seiteBreite}>{children}</View>
    </ScrollView>
  );
}

type Art = 'haupt' | 'neben' | 'gefahr';

export function Knopf({
  titel,
  onPress,
  art = 'haupt',
  icon,
  deaktiviert,
  testID,
}: {
  titel: string;
  onPress: () => void;
  art?: Art;
  icon?: IconName;
  deaktiviert?: boolean;
  testID?: string;
}) {
  const textFarbe = art === 'haupt' ? farbe.weiss : art === 'gefahr' ? farbe.rot : farbe.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={titel}
      disabled={deaktiviert}
      onPress={onPress}
      style={({ pressed }) => [
        s.knopf,
        art === 'haupt' && s.knopfHaupt,
        art === 'neben' && s.knopfNeben,
        art === 'gefahr' && s.knopfGefahr,
        (pressed || deaktiviert) && { opacity: 0.6 },
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={24} color={textFarbe} /> : null}
      <Text style={[s.knopfText, { color: textFarbe }]}>{titel}</Text>
    </Pressable>
  );
}

export function Feld({
  label,
  fehler,
  hinweis,
  ...rest
}: { label: string; fehler?: string; hinweis?: string } & TextInputProps) {
  return (
    <View style={s.feld}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor={farbe.textLeise}
        accessibilityLabel={label}
        style={[s.eingabe, rest.multiline && { minHeight: 96, textAlignVertical: 'top' }, !!fehler && { borderColor: farbe.rot }]}
        {...rest}
      />
      {fehler ? <Text style={s.fehler}>{fehler}</Text> : hinweis ? <Text style={s.hinweis}>{hinweis}</Text> : null}
    </View>
  );
}

export function SchalterZeile({
  label,
  wert,
  onChange,
  hinweis,
}: {
  label: string;
  wert: boolean;
  onChange: (v: boolean) => void;
  hinweis?: string;
}) {
  return (
    <View style={s.feld}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: wert }}
        accessibilityLabel={label}
        onPress={() => onChange(!wert)}
        style={s.schalterZeile}
      >
        <Text style={[s.label, { flex: 1, marginBottom: 0 }]}>{label}</Text>
        <Text style={[s.schalterWert, { color: wert ? farbe.ok : farbe.text }]}>{wert ? 'AN' : 'AUS'}</Text>
        {/* Nur die ganze Zeile reagiert auf Tippen – sonst würde doppelt umgeschaltet. */}
        <View pointerEvents="none">
          <Switch value={wert} trackColor={{ false: farbe.linieLeise, true: farbe.ok }} thumbColor={farbe.weiss} />
        </View>
      </Pressable>
      {hinweis ? <Text style={s.hinweis}>{hinweis}</Text> : null}
    </View>
  );
}

/** Große Listenzeile zum Antippen. */
export function Zeile({
  titel,
  untertitel,
  onPress,
  aktiv,
  icon,
  testID,
}: {
  titel: string;
  untertitel?: string;
  onPress: () => void;
  aktiv?: boolean;
  icon?: IconName;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.zeile, aktiv && s.zeileAktiv, pressed && { opacity: 0.7 }]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={26} color={aktiv ? farbe.weiss : farbe.navy} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[s.zeileTitel, aktiv && { color: farbe.weiss }]}>{titel}</Text>
        {untertitel ? <Text style={[s.zeileUnter, aktiv && { color: farbe.weiss }]}>{untertitel}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={28} color={aktiv ? farbe.weiss : farbe.text} />
    </Pressable>
  );
}

export function Ueberschrift({ children }: { children: ReactNode }) {
  return <Text style={s.ueberschrift}>{children}</Text>;
}

export function Text2({ children, leise }: { children: ReactNode; leise?: boolean }) {
  return <Text style={[s.text, leise && { color: farbe.textLeise }]}>{children}</Text>;
}

/** Hinweisbox, z. B. "Noch keine Einträge". */
export function Leer({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <View style={s.leer}>
      <Text style={s.leerText}>{text}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  seite: { flex: 1, backgroundColor: farbe.hintergrund },
  seiteInhalt: { padding: groesse.abstand, paddingBottom: 140, alignItems: 'center' },
  seiteBreite: { width: '100%', maxWidth: 900, gap: 12 },
  knopf: {
    minHeight: groesse.tippflaeche,
    borderRadius: groesse.radius,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  knopfHaupt: { backgroundColor: farbe.akzent },
  knopfNeben: { backgroundColor: farbe.hintergrund, borderWidth: 2, borderColor: farbe.linie },
  knopfGefahr: { backgroundColor: farbe.hintergrund, borderWidth: 2, borderColor: farbe.rot },
  knopfText: { fontSize: groesse.schrift, fontWeight: '700' },
  feld: { gap: 6 },
  label: { fontSize: groesse.schriftKlein, fontWeight: '700', color: farbe.text, marginBottom: 2 },
  eingabe: {
    minHeight: groesse.tippflaeche,
    borderWidth: 2,
    borderColor: farbe.linie,
    borderRadius: groesse.radius,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: groesse.schrift,
    color: farbe.text,
    backgroundColor: farbe.hintergrund,
  },
  fehler: { color: farbe.rot, fontSize: groesse.schriftKlein, fontWeight: '700' },
  hinweis: { color: farbe.textLeise, fontSize: groesse.schriftKlein },
  schalterZeile: {
    minHeight: groesse.tippflaeche,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: farbe.linie,
    borderRadius: groesse.radius,
    paddingHorizontal: 14,
  },
  schalterWert: { fontSize: groesse.schrift, fontWeight: '800' },
  zeile: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: farbe.linie,
    borderRadius: groesse.radius,
    backgroundColor: farbe.hintergrund,
  },
  zeileAktiv: { backgroundColor: farbe.navy, borderColor: farbe.navy },
  zeileTitel: { fontSize: groesse.schrift, fontWeight: '700', color: farbe.text },
  zeileUnter: { fontSize: groesse.schriftKlein, color: farbe.textLeise, marginTop: 2 },
  ueberschrift: { fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.text, marginTop: 8 },
  text: { fontSize: groesse.schrift, color: farbe.text, lineHeight: 26 },
  leer: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: farbe.linieLeise,
    borderRadius: groesse.radius,
    padding: 20,
    gap: 14,
    alignItems: 'stretch',
  },
  leerText: { fontSize: groesse.schrift, color: farbe.textLeise, textAlign: 'center' },
});

/** Auswahl-Chip (z. B. Wochentag, Rubrik). */
export function Chip({
  titel,
  aktiv,
  onPress,
  testID,
}: {
  titel: string;
  aktiv?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!aktiv }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [c.chip, aktiv && c.aktiv, pressed && { opacity: 0.7 }]}
    >
      <Text style={[c.text, aktiv && { color: farbe.weiss }]}>{titel}</Text>
    </Pressable>
  );
}

export function ChipReihe({ children }: { children: ReactNode }) {
  return <View style={c.reihe}>{children}</View>;
}

const c = StyleSheet.create({
  reihe: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: farbe.linie,
    justifyContent: 'center',
    backgroundColor: farbe.hintergrund,
  },
  aktiv: { backgroundColor: farbe.navy, borderColor: farbe.navy },
  text: { fontSize: groesse.schriftKlein + 1, fontWeight: '700', color: farbe.text },
});
