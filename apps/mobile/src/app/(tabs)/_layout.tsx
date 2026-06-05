import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAuth } from '@/auth/AuthContext';
import { Kairon } from '@/constants/kairon';
import { ROLES_COMERCIAL } from '@/constants/leads';

/**
 * Tab bar NATIVA (UITabBar no iOS). No iOS 26 ela ganha o material Liquid Glass
 * automaticamente — por isso NAO definimos backgroundColor (deixaria opaco e
 * mataria o glass). `tintColor` colore o item ativo com o vermelho Kairon e
 * `minimizeBehavior` ativa o tab bar que encolhe ao rolar (iOS 26).
 */
export default function TabsLayout() {
  const { user } = useAuth();
  // Tab Comercial visivel apenas para papeis comerciais (espelha o gate do web;
  // o RLS de qualquer forma so libera leads para esses papeis).
  const podeComercial = ROLES_COMERCIAL.includes(user?.role ?? '');

  return (
    <NativeTabs tintColor={Kairon.primary} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} />
        <NativeTabs.Trigger.Label>Visão Geral</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="agenda">
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} />
        <NativeTabs.Trigger.Label>Agenda</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="comercial" hidden={!podeComercial}>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
        <NativeTabs.Trigger.Label>Comercial</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
