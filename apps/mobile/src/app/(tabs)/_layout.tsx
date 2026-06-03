import { Tabs } from 'expo-router';
import { Text } from 'react-native';

import { Kairon } from '@/constants/kairon';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Kairon.primary,
        tabBarInactiveTintColor: Kairon.textMuted,
        tabBarStyle: {
          backgroundColor: Kairon.bgElevated,
          borderTopColor: Kairon.cardBorder,
        },
        sceneStyle: { backgroundColor: Kairon.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Visão Geral',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tarefas"
        options={{
          title: 'Tarefas',
          tabBarIcon: ({ focused }) => <TabIcon emoji="✅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
