import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAuth } from '@/auth/AuthContext';
import { Kairon } from '@/constants/kairon';
import { ROLES_COMERCIAL } from '@/constants/leads';
import { useLeadBadge } from '@/notifications/LeadBadgeContext';

/**
 * Tab bar NATIVA (UITabBar no iOS). No iOS 26 ela ganha o material Liquid Glass
 * automaticamente — por isso NAO definimos backgroundColor (deixaria opaco e
 * mataria o glass). `tintColor` colore o item ativo com o vermelho Kairon e
 * `minimizeBehavior` ativa o tab bar que encolhe ao rolar (iOS 26).
 */
export default function TabsLayout() {
  const { user } = useAuth();
  const { count } = useLeadBadge();
  // Tab Comercial visivel apenas para papeis comerciais (espelha o gate do web;
  // o RLS de qualquer forma so libera leads para esses papeis).
  const podeComercial = ROLES_COMERCIAL.includes(user?.role ?? '');

  return (
    <NativeTabs tintColor={Kairon.primary} minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'text.rectangle.page', selected: 'text.rectangle.page.fill' }} />
        <NativeTabs.Trigger.Label>Hoje</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="agenda">
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} />
        <NativeTabs.Trigger.Label>Agenda</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="comercial" hidden={!podeComercial}>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} />
        <NativeTabs.Trigger.Label>Comercial</NativeTabs.Trigger.Label>
        {/* children precisa ser undefined quando 0 — uma string "0" é truthy e o
            nativo mostraria o badge mesmo com hidden. */}
        <NativeTabs.Trigger.Badge hidden={count === 0}>
          {count > 0 ? (count > 99 ? '99+' : String(count)) : undefined}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
