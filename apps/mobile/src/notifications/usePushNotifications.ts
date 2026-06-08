import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/auth/AuthContext';

import { ensureNotificationPermission, getExpoPushToken, savePushToken } from './push';

// Com o app em foreground, ainda exibimos o banner do push (notificação
// "in-app"). Em background/fechado o próprio SO mostra. Assim a mesma entrega
// de push cobre os dois casos, sem duplicar.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Liga o push do dispositivo à sessão:
 *  - registra/salva o Expo token quando o usuário está autenticado;
 *  - ao tocar numa notificação (inclusive abrindo o app a partir dela),
 *    navega pelo `link` que veio no payload (ex.: /comercial).
 *
 * Chamado uma vez, dentro do AuthProvider (ver _layout.tsx).
 */
export function usePushNotifications() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const handledColdStart = useRef(false);

  // Registra o token quando autentica.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    let cancelled = false;
    (async () => {
      const granted = await ensureNotificationPermission();
      if (!granted || cancelled) return;
      const token = await getExpoPushToken();
      if (!token || cancelled) return;
      await savePushToken(user.id, token);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  // Toque na notificação => navega pelo link.
  useEffect(() => {
    const navigateFromData = (data: unknown) => {
      const link = (data as { link?: string } | undefined)?.link;
      if (link) router.push(link as never);
    };

    // App aberto a partir de uma notificação (cold start).
    if (!handledColdStart.current) {
      handledColdStart.current = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) navigateFromData(response.notification.request.content.data);
      });
    }

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigateFromData(response.notification.request.content.data);
    });
    return () => sub.remove();
  }, [router]);
}
