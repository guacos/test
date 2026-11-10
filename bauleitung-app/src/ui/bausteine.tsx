import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Children, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { farbe, groesse, schatten, TON, type Ton } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Scrollbarer Inhalt mit Seitenrand, auf breiten Bildschirmen zentriert. */
export function Seite({ children, breit, unten = 140 }: { children: ReactNode; breit?: boolean; unten?: number }) {
  return (
    <ScrollView
      style={s.seite}
      contentContainerStyle={[s.seiteInhalt, { paddingBottom: unten }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[s.seiteBreite, breit && { maxWidth: 1280 }]}>{children}</View>
    </ScrollView>
  );
}

/** Weiße Karte mit weichem Schatten; optional antippbar und mit farbigem Balken links. */
export function Karte({
  children,
  onPress,
  balken,
  stil,
  testID,
}: {
  children: ReactNode;
  onPress?: () => void;
  balken?: string;
  stil?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const inhalt = (
    <>
      {balken ? <View style={[s.balken, { backgroundColor: balken }]} /> : null}
      <View style={[s.karteInhalt, balken ? { paddingLeft: 18 } : null]}>{children}</View>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [s.karte, stil, pressed && { opacity: 0.85 }]}
      >
        {inhalt}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[s.karte, stil]}>
      {inhalt}
    </View>
  );
}

type Art = 'haupt' | 'neben' | 'gefahr' | 'leise' | 'navy';

export function Knopf({
  titel,
  onPress,
  art = 'haupt',
  icon,
  deaktiviert,
  klein,
  testID,
}: {
  titel: string;
  onPress: () => void;
  art?: Art;
  icon?: IconName;
  deaktiviert?: boolean;
  klein?: boolean;
  testID?: string;
}) {
  const vorn =
    art === 'haupt' || art === 'navy' ? farbe.weiss : art === 'gefahr' ? farbe.rot : art === 'leise' ? farbe.navy : farbe.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={titel}
      accessibilityState={{ disabled: !!deaktiviert }}
      disabled={deaktiviert}
      onPress={onPress}
      style={({ pressed }) => [
        s.knopf,
        klein && s.knopfKlein,
        art === 'haupt' && s.knopfHaupt,
        art === 'navy' && s.knopfNavy,
        art === 'neben' && s.knopfNeben,
        art === 'gefahr' && s.knopfGefahr,
        art === 'leise' && s.knopfLeise,
        pressed && { opacity: 0.75, transform: [{ scale: 0.99 }] },
        deaktiviert && { opacity: 0.45 },
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={klein ? 20 : 24} color={vorn} /> : null}
      <Text style={[s.knopfText, klein && { fontSize: groesse.schriftKlein + 1 }, { color: vorn }]}>{titel}</Text>
    </Pressable>
  );
}

/** Runder Knopf nur mit Symbol. */
export function IconKnopf({
  icon,
  onPress,
  label,
  ton = 'navy',
  testID,
  gross,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  ton?: Ton;
  testID?: string;
  gross?: boolean;
}) {
  const t = TON[ton];
  const d = gross ? 56 : 46;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        { width: d, height: d, borderRadius: d / 2, backgroundColor: t.hinten, alignItems: 'center', justifyContent: 'center' },
        pressed && { opacity: 0.6 },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={gross ? 30 : 24} color={t.vorn} />
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
        placeholderTextColor="#7A8492"
        accessibilityLabel={label}
        {...rest}
        style={[s.eingabe, rest.multiline && { minHeight: 96, textAlignVertical: 'top' }, !!fehler && { borderColor: farbe.rot }, rest.style]}
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
  testID,
}: {
  label: string;
  wert: boolean;
  onChange: (v: boolean) => void;
  hinweis?: string;
  testID?: string;
}) {
  return (
    <View style={s.feld}>
      <Pressable
        testID={testID}
        accessibilityRole="switch"
        accessibilityState={{ checked: wert }}
        accessibilityLabel={label}
        onPress={() => onChange(!wert)}
        style={[s.schalterZeile, wert && { borderColor: farbe.ok, backgroundColor: farbe.okZart }]}
      >
        <Text style={[s.label, { flex: 1, marginBottom: 0, fontSize: groesse.schrift }]}>{label}</Text>
        <Text style={[s.schalterWert, { color: wert ? farbe.ok : farbe.textLeise }]}>{wert ? 'AN' : 'AUS'}</Text>
        {/* Nur die ganze Zeile reagiert auf Tippen – sonst würde doppelt umgeschaltet. */}
        <View pointerEvents="none">
          <Switch value={wert} trackColor={{ false: '#9AA3AF', true: farbe.ok }} thumbColor={farbe.weiss} />
        </View>
      </Pressable>
      {hinweis ? <Text style={s.hinweis}>{hinweis}</Text> : null}
    </View>
  );
}

/** Listenzeile: Symbol im farbigen Kreis, Titel, Untertitel, rechts Zusatz oder Pfeil. */
export function Zeile({
  titel,
  untertitel,
  onPress,
  aktiv,
  icon,
  ton = 'navy',
  rechts,
  testID,
}: {
  titel: string;
  untertitel?: string;
  onPress?: () => void;
  aktiv?: boolean;
  icon?: IconName;
  ton?: Ton;
  rechts?: ReactNode;
  testID?: string;
}) {
  const t = TON[ton];
  const inhalt = (
    <>
      {icon ? (
        <View style={[s.zeileIcon, { backgroundColor: aktiv ? 'rgba(255,255,255,0.18)' : t.hinten }]}>
          <MaterialCommunityIcons name={icon} size={24} color={aktiv ? farbe.weiss : t.vorn} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[s.zeileTitel, aktiv && { color: farbe.weiss }]}>{titel}</Text>
        {untertitel ? <Text style={[s.zeileUnter, aktiv && { color: '#D8E1EA' }]}>{untertitel}</Text> : null}
      </View>
      {rechts}
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={26} color={aktiv ? farbe.weiss : '#7A8492'} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View testID={testID} style={[s.zeile, aktiv && s.zeileAktiv]}>
        {inhalt}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.zeile, aktiv && s.zeileAktiv, pressed && { opacity: 0.8 }]}
    >
      {inhalt}
    </Pressable>
  );
}

/** Abschnitts-Überschrift, optional mit Aktion rechts. */
export function Abschnitt({
  titel,
  aktion,
  children,
}: {
  titel: string;
  aktion?: { titel: string; onPress: () => void; icon?: IconName; testID?: string };
  children?: ReactNode;
}) {
  return (
    <View style={{ gap: 10, marginTop: 10 }}>
      <View style={s.abschnittKopf}>
        <Text style={s.abschnittTitel}>{titel}</Text>
        {aktion ? (
          <Pressable
            testID={aktion.testID}
            accessibilityRole="button"
            onPress={aktion.onPress}
            hitSlop={8}
            style={({ pressed }) => [s.abschnittAktion, pressed && { opacity: 0.6 }]}
          >
            {aktion.icon ? <MaterialCommunityIcons name={aktion.icon} size={20} color={farbe.akzent} /> : null}
            <Text style={s.abschnittAktionText}>{aktion.titel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Ueberschrift({ children }: { children: ReactNode }) {
  return <Text style={s.ueberschrift}>{children}</Text>;
}

export function Text2({ children, leise, fett, farbeText }: { children: ReactNode; leise?: boolean; fett?: boolean; farbeText?: string }) {
  return (
    <Text style={[s.text, leise && { color: farbe.textLeise, fontSize: groesse.schriftKlein + 0.5, lineHeight: 21 }, fett && { fontWeight: '700' }, farbeText ? { color: farbeText } : null]}>
      {children}
    </Text>
  );
}

/** Leerer Zustand mit Symbol, Text und optionaler Aktion. */
export function Leer({ text, icon = 'tray', children }: { text: string; icon?: IconName; children?: ReactNode }) {
  return (
    <View style={s.leer}>
      <View style={s.leerIcon}>
        <MaterialCommunityIcons name={icon} size={30} color={farbe.navy} />
      </View>
      <Text style={s.leerText}>{text}</Text>
      {children}
    </View>
  );
}

/** Kleines farbiges Etikett. */
export function Badge({ text, ton = 'neutral', icon }: { text: string; ton?: Ton; icon?: IconName }) {
  const t = TON[ton];
  return (
    <View style={[s.badge, { backgroundColor: t.hinten }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={14} color={t.vorn} /> : null}
      <Text style={[s.badgeText, { color: t.vorn }]}>{text}</Text>
    </View>
  );
}

/** Auswahl-Chip (z. B. Wochentag, Rubrik, Filter). */
export function Chip({
  titel,
  aktiv,
  onPress,
  testID,
  icon,
}: {
  titel: string;
  aktiv?: boolean;
  onPress?: () => void;
  testID?: string;
  icon?: IconName;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!aktiv }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [s.chip, aktiv && s.chipAktiv, pressed && { opacity: 0.7 }]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={aktiv ? farbe.weiss : farbe.navy} /> : null}
      <Text style={[s.chipText, aktiv && { color: farbe.weiss }]}>{titel}</Text>
    </Pressable>
  );
}

export function ChipReihe({ children }: { children: ReactNode }) {
  return <View style={s.chipReihe}>{children}</View>;
}

/** Einfachauswahl aus einer Liste als Chips; optional mit "kein Wert". */
export function Auswahl<T extends string>({
  label,
  werte,
  wert,
  onChange,
  leerText,
  testID,
}: {
  label?: string;
  werte: readonly T[];
  wert: T | null;
  onChange: (w: T | null) => void;
  /** Text für "kein Wert"; fehlt er, kann nicht abgewählt werden */
  leerText?: string;
  testID?: string;
}) {
  return (
    <View style={s.feld}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <ChipReihe>
        {leerText ? <Chip titel={leerText} aktiv={wert === null} onPress={() => onChange(null)} /> : null}
        {werte.map((w) => (
          <Chip
            key={w}
            testID={testID ? `${testID}-${w}` : undefined}
            titel={w}
            aktiv={wert === w}
            onPress={() => onChange(wert === w && leerText ? null : w)}
          />
        ))}
      </ChipReihe>
    </View>
  );
}

/** Großes Abhak-Feld mit Text (Checkpunkte, Prüfkette). */
export function Haken({
  text,
  wert,
  onChange,
  testID,
  rechts,
}: {
  text: string;
  wert: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
  rechts?: ReactNode;
}) {
  return (
    <View style={s.hakenZeile}>
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: wert }}
        accessibilityLabel={text}
        onPress={() => onChange(!wert)}
        style={({ pressed }) => [s.hakenTippen, pressed && { opacity: 0.6 }]}
      >
        <View style={[s.hakenBox, wert && s.hakenBoxAn]}>
          {wert ? <MaterialCommunityIcons name="check-bold" size={22} color={farbe.weiss} /> : null}
        </View>
        <Text style={[s.hakenText, wert && s.hakenTextAn]}>{text}</Text>
      </Pressable>
      {rechts}
    </View>
  );
}

/** Plus/Minus-Zähler mit großen Tasten. */
export function Zaehler({ wert, onChange, min = 0, testID }: { wert: number; onChange: (n: number) => void; min?: number; testID?: string }) {
  return (
    <View style={s.zaehler}>
      <Pressable
        testID={testID ? `${testID}-minus` : undefined}
        accessibilityRole="button"
        accessibilityLabel="weniger"
        onPress={() => onChange(Math.max(min, wert - 1))}
        style={({ pressed }) => [s.zaehlerTaste, pressed && { opacity: 0.6 }]}
      >
        <MaterialCommunityIcons name="minus" size={28} color={farbe.navy} />
      </Pressable>
      <Text testID={testID ? `${testID}-wert` : undefined} style={s.zaehlerWert}>
        {wert}
      </Text>
      <Pressable
        testID={testID ? `${testID}-plus` : undefined}
        accessibilityRole="button"
        accessibilityLabel="mehr"
        onPress={() => onChange(wert + 1)}
        style={({ pressed }) => [s.zaehlerTaste, { backgroundColor: farbe.navy }, pressed && { opacity: 0.7 }]}
      >
        <MaterialCommunityIcons name="plus" size={28} color={farbe.weiss} />
      </Pressable>
    </View>
  );
}

/** Kennzahl-Kachel für die Startseite. */
export function Kennzahl({
  wert,
  label,
  ton = 'navy',
  icon,
  onPress,
  testID,
}: {
  wert: string | number;
  label: string;
  ton?: Ton;
  icon: IconName;
  onPress?: () => void;
  testID?: string;
}) {
  const t = TON[ton];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [s.kennzahl, pressed && { opacity: 0.8 }]}
    >
      <View style={[s.kennzahlIcon, { backgroundColor: t.hinten }]}>
        <MaterialCommunityIcons name={icon} size={22} color={t.vorn} />
      </View>
      <Text style={[s.kennzahlWert, { color: t.vorn }]}>{wert}</Text>
      <Text style={s.kennzahlLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Raster mit gleich breiten Kacheln: Anzahl der Spalten richtet sich nach der Breite.
 * Die letzte Zeile wird nicht gestreckt.
 */
export function Raster({ children, minBreite = 150, abstand = 10 }: { children: ReactNode; minBreite?: number; abstand?: number }) {
  const [breite, setBreite] = useState(0);
  const spalten = breite ? Math.max(2, Math.floor((breite + abstand) / (minBreite + abstand))) : 2;
  const kachel = breite ? Math.floor((breite - abstand * (spalten - 1)) / spalten) : 0;
  return (
    <View onLayout={(e) => setBreite(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: abstand }}>
      {kachel
        ? Children.toArray(children).map((kind, i) => (
            <View key={i} style={{ width: kachel }}>
              {kind}
            </View>
          ))
        : null}
    </View>
  );
}

export function Trenner() {
  return <View style={{ height: 1, backgroundColor: farbe.linieLeise }} />;
}

/** Zwei oder mehr Elemente nebeneinander mit gleicher Breite. */
export function Reihe({ children, abstand = 12 }: { children: ReactNode; abstand?: number }) {
  const kinder = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={{ flexDirection: 'row', gap: abstand, alignItems: 'flex-start' }}>
      {kinder.map((k, i) => (
        <View key={i} style={{ flex: 1 }}>
          {k}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  seite: { flex: 1, backgroundColor: farbe.hintergrund },
  seiteInhalt: { padding: groesse.abstand, alignItems: 'center' },
  seiteBreite: { width: '100%', maxWidth: 960, gap: 14 },
  karte: {
    backgroundColor: farbe.karte,
    borderRadius: groesse.radius,
    borderWidth: 1,
    borderColor: farbe.linieLeise,
    overflow: 'hidden',
    ...schatten,
  },
  karteInhalt: { padding: 14, gap: 10 },
  balken: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 },
  knopf: {
    minHeight: groesse.tippflaeche,
    borderRadius: groesse.radius,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  knopfKlein: { minHeight: 44, paddingHorizontal: 14, borderRadius: groesse.radiusKlein },
  knopfHaupt: { backgroundColor: farbe.akzent, ...schatten },
  knopfNavy: { backgroundColor: farbe.navy },
  knopfNeben: { backgroundColor: farbe.karte, borderWidth: 1.5, borderColor: farbe.linie },
  knopfGefahr: { backgroundColor: farbe.karte, borderWidth: 1.5, borderColor: farbe.rot },
  knopfLeise: { backgroundColor: farbe.navyZart },
  knopfText: { fontSize: groesse.schrift, fontWeight: '700' },
  feld: { gap: 6 },
  label: { fontSize: groesse.schriftKlein, fontWeight: '700', color: farbe.textLeise, marginBottom: 1 },
  eingabe: {
    minHeight: groesse.tippflaeche,
    borderWidth: 1.5,
    borderColor: farbe.linie,
    borderRadius: groesse.radiusKlein + 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: groesse.schrift + 1,
    color: farbe.text,
    backgroundColor: farbe.karte,
  },
  fehler: { color: farbe.rot, fontSize: groesse.schriftKlein, fontWeight: '700' },
  hinweis: { color: farbe.textLeise, fontSize: groesse.schriftKlein, lineHeight: 20 },
  schalterZeile: {
    minHeight: groesse.tippflaeche + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: farbe.linie,
    borderRadius: groesse.radiusKlein + 2,
    paddingHorizontal: 14,
    backgroundColor: farbe.karte,
  },
  schalterWert: { fontSize: groesse.schrift, fontWeight: '800' },
  zeile: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: farbe.linieLeise,
    borderRadius: groesse.radius,
    backgroundColor: farbe.karte,
    ...schatten,
  },
  zeileAktiv: { backgroundColor: farbe.navy, borderColor: farbe.navy },
  zeileIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  zeileTitel: { fontSize: groesse.schrift, fontWeight: '700', color: farbe.text },
  zeileUnter: { fontSize: groesse.schriftKlein, color: farbe.textLeise, marginTop: 2, lineHeight: 20 },
  abschnittKopf: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  abschnittTitel: { fontSize: 13, fontWeight: '800', color: farbe.textLeise, letterSpacing: 1, textTransform: 'uppercase' },
  abschnittAktion: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 },
  abschnittAktionText: { fontSize: groesse.schriftKlein + 1, fontWeight: '800', color: farbe.akzent },
  ueberschrift: { fontSize: groesse.titel, fontWeight: '800', color: farbe.text, letterSpacing: -0.3 },
  text: { fontSize: groesse.schrift, color: farbe.text, lineHeight: 25 },
  leer: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: farbe.linie,
    borderRadius: groesse.radius,
    padding: 22,
    gap: 12,
    alignItems: 'stretch',
    backgroundColor: farbe.karte,
  },
  leerIcon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: farbe.navyZart,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leerText: { fontSize: groesse.schrift, color: farbe.textLeise, textAlign: 'center', lineHeight: 24 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12.5, fontWeight: '800' },
  chipReihe: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: farbe.linie,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: farbe.karte,
  },
  chipAktiv: { backgroundColor: farbe.navy, borderColor: farbe.navy },
  chipText: { fontSize: groesse.schriftKlein + 1, fontWeight: '700', color: farbe.text },
  hakenZeile: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hakenTippen: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 4 },
  hakenBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#6B7685',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: farbe.karte,
  },
  hakenBoxAn: { backgroundColor: farbe.ok, borderColor: farbe.ok },
  hakenText: { flex: 1, fontSize: groesse.schrift, color: farbe.text, lineHeight: 23 },
  hakenTextAn: { color: farbe.textLeise, textDecorationLine: 'line-through' },
  zaehler: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  zaehlerTaste: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: farbe.navyZart,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zaehlerWert: { minWidth: 40, textAlign: 'center', fontSize: 24, fontWeight: '800', color: farbe.text },
  kennzahl: {
    minHeight: 136,
    backgroundColor: farbe.karte,
    borderRadius: groesse.radius,
    borderWidth: 1,
    borderColor: farbe.linieLeise,
    padding: 14,
    gap: 4,
    ...schatten,
  },
  kennzahlIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  kennzahlWert: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  kennzahlLabel: { fontSize: groesse.schriftKlein, color: farbe.textLeise, fontWeight: '600', lineHeight: 19 },
});
