import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Kairon } from '@/constants/kairon';

/**
 * Tab bar NATIVA (UITabBar no iOS). No iOS 26 ela ganha o material Liquid Glass
 * automaticamente — por isso NAO definimos backgroundColor (deixaria opaco e
 * mataria o glass). `tintColor` colore o item ativo com o vermelho Kairon e
 * `minimizeBehavior` ativa o tab bar que encolhe ao rolar (iOS 26).
 */
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={Kairon.primary} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} />
        <NativeTabs.Trigger.Label>Visão Geral</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="tarefas">
        <NativeTabs.Trigger.Icon sf={{ default: 'checklist.unchecked', selected: 'checklist' }} />
        <NativeTabs.Trigger.Label>Tarefas</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
