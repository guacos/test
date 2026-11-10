import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Foto } from '../domain/types';
import { Bild } from './Bild';
import { farbe } from './theme';

/** Grundriss mit Stecknadel. Antippen setzt die Position (0..1 von links/oben). */
export function PlanPin({
  foto,
  pin,
  onPin,
  testID = 'plan',
}: {
  foto: Foto;
  pin: { x: number; y: number } | null;
  onPin?: (p: { x: number; y: number }) => void;
  testID?: string;
}) {
  const [g, setG] = useState({ w: 0, h: 0 });
  const grenze = (n: number) => Math.min(1, Math.max(0, n));
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPin ? 'button' : 'image'}
      accessibilityLabel="Grundriss – antippen, um die Position zu setzen"
      disabled={!onPin}
      onLayout={(e) => setG({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      onPress={(e) => {
        if (!onPin || !g.w || !g.h) return;
        const n = e.nativeEvent as unknown as { locationX?: number; locationY?: number; offsetX?: number; offsetY?: number };
        const x = n.locationX ?? n.offsetX;
        const y = n.locationY ?? n.offsetY;
        if (typeof x !== 'number' || typeof y !== 'number') return;
        onPin({ x: Math.round(grenze(x / g.w) * 1000) / 1000, y: Math.round(grenze(y / g.h) * 1000) / 1000 });
      }}
      style={{ width: '100%', aspectRatio: foto.breite / foto.hoehe || 4 / 3, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: farbe.linie, backgroundColor: farbe.flaeche }}
    >
      <View pointerEvents="none" style={{ width: '100%', height: '100%' }}>
        <Bild foto={foto} einpassen style={{ width: '100%', height: '100%' }} />
      </View>
      {pin && g.w ? (
        <View pointerEvents="none" testID="pin" style={{ position: 'absolute', left: pin.x * g.w - 20, top: pin.y * g.h - 38 }}>
          <MaterialCommunityIcons name="map-marker" size={40} color={farbe.rot} />
        </View>
      ) : null}
    </Pressable>
  );
}
