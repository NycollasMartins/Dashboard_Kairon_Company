import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@kairon/core/supabase/client';

/**
 * Push notifications (Expo) do app mobile.
 *
 * Fluxo: no login pedimos permissão, pegamos o Expo push token deste
 * dispositivo e guardamos em `public.push_tokens` (upsert por token, RLS por
 * usuário). O envio é feito pelo servidor (gatilho em `notifications` =>
 * Edge Function `push-fanout` => Expo Push API).
 */

/**
 * Garante o canal Android "default" (necessário p/ heads-up no Android 8+)
 * e pede permissão de notificação. Retorna true se concedida.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Geral',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F0211F',
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Pega o Expo push token deste dispositivo. Requer device físico (push não
 * funciona em simulador) e o `projectId` do EAS. Retorna null se indisponível.
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) return null;

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Upsert do token na tabela push_tokens. `onConflict: token` reatribui o
 * dispositivo ao usuário atual caso a conta tenha trocado.
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  await supabase
    .from('push_tokens')
    .upsert(
      { user_id: userId, token, platform: Platform.OS },
      { onConflict: 'token' },
    );
}
