import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/tabs';
import { View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusKnopf, ProjektKopf } from '../../ui/Rahmen';
import { farbe } from '../../ui/theme';
import type { IconName } from '../../ui/bausteine';

const TAB_HOEHE = 68;

function icon(name: IconName) {
  return ({ color }: { color: ColorValue }) => <MaterialCommunityIcons name={name} size={30} color={typeof color === 'number' ? undefined : (color ?? undefined)} />;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: farbe.navy },
          headerTintColor: farbe.weiss,
          headerTitle: () => <ProjektKopf />,
          headerTitleAlign: 'left',
          tabBarActiveTintColor: farbe.akzent,
          tabBarInactiveTintColor: farbe.text,
          tabBarStyle: {
            height: TAB_HOEHE + insets.bottom,
            paddingBottom: insets.bottom + 6,
            paddingTop: 6,
            borderTopWidth: 2,
            borderTopColor: farbe.linie,
          },
          tabBarLabelStyle: { fontSize: 14, fontWeight: '800' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Board', tabBarIcon: icon('view-dashboard') }} />
        <Tabs.Screen name="fotos" options={{ title: 'Fotos', tabBarIcon: icon('camera') }} />
        <Tabs.Screen name="jourfixe" options={{ title: 'Jour Fixe', tabBarIcon: icon('clipboard-text') }} />
        <Tabs.Screen name="mehr" options={{ title: 'Mehr', tabBarIcon: icon('dots-horizontal') }} />
      </Tabs>
      <PlusKnopf unten={TAB_HOEHE + insets.bottom + 16} />
    </View>
  );
}
