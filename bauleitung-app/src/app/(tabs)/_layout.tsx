import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/tabs';
import { View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '../../ui/bausteine';
import { PlusKnopf, ProjektKopf, SyncAnzeige } from '../../ui/Rahmen';
import { farbe, useBreit } from '../../ui/theme';

const TAB_HOEHE = 66;

function icon(name: IconName) {
  return ({ color }: { color: ColorValue }) => (
    <MaterialCommunityIcons name={name} size={27} color={typeof color === 'number' ? undefined : (color ?? undefined)} />
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const breit = useBreit();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: farbe.navy },
          headerTintColor: farbe.weiss,
          headerTitle: () => <ProjektKopf />,
          headerRight: () => <SyncAnzeige />,
          headerTitleAlign: 'left',
          headerShadowVisible: false,
          tabBarPosition: breit ? 'left' : 'bottom',
          tabBarActiveTintColor: farbe.akzent,
          tabBarActiveBackgroundColor: breit ? farbe.akzentZart : undefined,
          tabBarItemStyle: breit ? { borderRadius: 12, marginHorizontal: 8, marginVertical: 2 } : undefined,
          tabBarInactiveTintColor: '#3D4756',
          tabBarStyle: breit
            ? { backgroundColor: farbe.karte, borderRightWidth: 1, borderRightColor: farbe.linieLeise, paddingTop: 10, minWidth: 210 }
            : {
                height: TAB_HOEHE + insets.bottom,
                paddingBottom: insets.bottom + 6,
                paddingTop: 6,
                backgroundColor: farbe.karte,
                borderTopWidth: 1,
                borderTopColor: farbe.linieLeise,
              },
          tabBarLabelStyle: { fontSize: breit ? 15 : 12.5, fontWeight: '700' },
          sceneStyle: { backgroundColor: farbe.hintergrund },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Start', tabBarIcon: icon('home-variant') }} />
        <Tabs.Screen name="board" options={{ title: 'Board', tabBarIcon: icon('view-dashboard') }} />
        <Tabs.Screen name="fotos" options={{ title: 'Fotos', tabBarIcon: icon('camera') }} />
        <Tabs.Screen name="jourfixe" options={{ title: 'Jour Fixe', tabBarIcon: icon('clipboard-text') }} />
        <Tabs.Screen name="mehr" options={{ title: 'Mehr', tabBarIcon: icon('dots-grid') }} />
      </Tabs>
      <PlusKnopf unten={breit ? 28 : TAB_HOEHE + insets.bottom + 14} />
    </View>
  );
}
