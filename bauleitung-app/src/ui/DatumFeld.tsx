/** Android: Datumsfeld mit dem System-Kalender. */
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ausIso, datumDe, heuteIso } from '../domain/datum';
import { farbe, groesse } from './theme';

export function DatumFeld({
  label,
  wert,
  onChange,
  leerbar,
  testID,
}: {
  label: string;
  wert: string;
  onChange: (iso: string) => void;
  leerbar?: boolean;
  testID?: string;
}) {
  function oeffnen() {
    DateTimePickerAndroid.open({
      value: ausIso(wert) ?? new Date(),
      mode: 'date',
      onChange: (ereignis, datum) => {
        if (ereignis.type === 'set' && datum) onChange(heuteIso(datum));
      },
    });
  }
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.zeile}>
        <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={oeffnen} style={s.feld}>
          <MaterialCommunityIcons name="calendar" size={22} color={farbe.navy} />
          <Text style={[s.text, !wert && { color: '#7A8492' }]}>{wert ? datumDe(wert) : 'Datum wählen'}</Text>
        </Pressable>
        {leerbar && wert ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Datum entfernen" onPress={() => onChange('')} hitSlop={8} style={s.x}>
            <MaterialCommunityIcons name="close" size={22} color={farbe.textLeise} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: groesse.schriftKlein, fontWeight: '700', color: farbe.textLeise },
  zeile: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feld: {
    flex: 1,
    minHeight: groesse.tippflaeche,
    borderWidth: 1.5,
    borderColor: farbe.linie,
    borderRadius: groesse.radiusKlein + 2,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: farbe.karte,
  },
  text: { fontSize: groesse.schrift + 1, color: farbe.text },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
