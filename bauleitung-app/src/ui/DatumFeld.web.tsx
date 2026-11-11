/** Browser: natives Datumsfeld. */
import { createElement } from 'react';
import { Text, View } from 'react-native';
import { farbe, groesse } from './theme';

export function DatumFeld({
  label,
  wert,
  onChange,
  testID,
}: {
  label: string;
  wert: string;
  onChange: (iso: string) => void;
  leerbar?: boolean;
  testID?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: groesse.schriftKlein, fontWeight: '700', color: farbe.textLeise }}>{label}</Text>
      {createElement('input', {
        type: 'date',
        value: wert,
        'aria-label': label,
        'data-testid': testID,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        style: {
          minHeight: groesse.tippflaeche,
          border: `1.5px solid ${farbe.linie}`,
          borderRadius: groesse.radiusKlein + 2,
          padding: '0 14px',
          fontSize: groesse.schrift + 1,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          color: farbe.text,
          backgroundColor: farbe.karte,
          boxSizing: 'border-box',
          width: '100%',
        },
      })}
    </View>
  );
}
