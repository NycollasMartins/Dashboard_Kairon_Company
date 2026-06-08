import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@kairon/core/supabase/client';

import { useAuth } from '@/auth/AuthContext';

type LeadBadgeValue = {
  /** Quantidade de leads não lidos do usuário. */
  count: number;
  /** Marca todos os leads como lidos (chamado ao abrir a tela Comercial). */
  markLeadsRead: () => Promise<void>;
};

const LeadBadgeContext = createContext<LeadBadgeValue>({
  count: 0,
  markLeadsRead: async () => {},
});

/**
 * Conta de leads NÃO LIDOS (notifications type='lead', read_at null) do usuário.
 *
 * - Mantém o badge do ícone do app (setBadgeCountAsync) em foreground.
 * - Expõe `count` para o badge da tab Comercial.
 * - Atualiza ao vivo via realtime nas notificações do usuário.
 * - `markLeadsRead()` zera tudo quando a pessoa abre a tela Comercial.
 *
 * (O badge do ícone com o app fechado/background vem do campo `badge` no push,
 *  preenchido pela Edge Function push-fanout.)
 */
export function LeadBadgeProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    const { count: c } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('type', 'lead')
      .is('read_at', null);
    setCount(c ?? 0);
  }, [isAuthenticated]);

  // Carrega ao autenticar + realtime nas próprias notificações.
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setCount(0);
      return;
    }
    refresh();
    const channel = supabase
      .channel('notifications-badge-mobile')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id, refresh]);

  // Reflete a contagem no badge do ícone do app (foreground).
  useEffect(() => {
    Notifications.setBadgeCountAsync(count).catch(() => {});
  }, [count]);

  const markLeadsRead = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;
    // Otimista: zera na hora (UI + ícone) e persiste em seguida.
    setCount(0);
    Notifications.setBadgeCountAsync(0).catch(() => {});
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('type', 'lead')
      .is('read_at', null);
  }, [isAuthenticated, user?.id]);

  return (
    <LeadBadgeContext.Provider value={{ count, markLeadsRead }}>
      {children}
    </LeadBadgeContext.Provider>
  );
}

export function useLeadBadge() {
  return useContext(LeadBadgeContext);
}
