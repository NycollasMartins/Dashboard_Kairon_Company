import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { queryKeys } from '@/entities/query-keys';
import { notificationsApi } from '@/features/notifications/api/notifications.api';
import MetaCelebrationModal from '@/features/metas/components/MetaCelebrationModal';

const NotificationsContext = createContext(null);

// --- som (Web Audio, sem precisar de arquivo) ---
let audioCtx = null;
function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    [0, 0.18].forEach((delay, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g);
      g.connect(audioCtx.destination);
      o.type = 'sine';
      o.frequency.value = i === 0 ? 784 : 1046; // sol -> dó
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(0.18, t + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.16);
      o.start(t + delay);
      o.stop(t + delay + 0.16);
    });
  } catch { /* ignore */ }
}

function showDesktop(n) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      // eslint-disable-next-line no-new
      new Notification(n.title, { body: n.body || '', icon: '/lp_kairon_company.png', tag: n.id });
    }
  } catch { /* ignore */ }
}

export function requestNotificationPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch { /* ignore */ }
}

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [celebration, setCelebration] = useState(null);

  const { data: notifications = [] } = useQuery({
    queryKey: queryKeys.notifications.all,
    queryFn: () => notificationsApi.list(40),
    enabled: !!user?.id,
  });

  // Realtime: novas notificações em tempo real -> som + desktop + toast.
  useEffect(() => {
    if (!user?.id) return undefined;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new;
        qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
        playBeep();
        showDesktop(n);
        toast({ title: n.title, description: n.body || undefined });
        // Meta batida => popup de comemoração global (todos do dash).
        if (n.type === 'meta' && n.metadata?.evento === 'meta_batida') {
          setCelebration({ title: n.title, body: String(n.body || '').split(' Agora começa')[0] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, qc, toast]);

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey: queryKeys.notifications.all }), [qc]);

  const markAllRead = useCallback(async () => { await notificationsApi.markAllRead(); invalidate(); }, [invalidate]);
  const markRead = useCallback(async (id) => { await notificationsApi.markRead(id); invalidate(); }, [invalidate]);
  const markTypeRead = useCallback(async (type) => { await notificationsApi.markTypeRead(type); invalidate(); }, [invalidate]);
  const remove = useCallback(async (id) => { await notificationsApi.remove(id); invalidate(); }, [invalidate]);
  const removeAll = useCallback(async () => { await notificationsApi.removeAll(); invalidate(); }, [invalidate]);

  const { unreadCount, leadUnreadCount } = useMemo(() => {
    let unread = 0;
    let lead = 0;
    for (const n of notifications) {
      if (!n.read_at) {
        unread += 1;
        if (n.type === 'lead') lead += 1;
      }
    }
    return { unreadCount: unread, leadUnreadCount: lead };
  }, [notifications]);

  const value = {
    notifications,
    unreadCount,
    leadUnreadCount,
    markAllRead,
    markRead,
    markTypeRead,
    remove,
    removeAll,
    requestPermission: requestNotificationPermission,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      {celebration && (
        <MetaCelebrationModal
          title={celebration.title}
          body={celebration.body}
          onClose={() => setCelebration(null)}
        />
      )}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  return ctx ?? {
    notifications: [], unreadCount: 0, leadUnreadCount: 0,
    markAllRead: () => {}, markRead: () => {}, markTypeRead: () => {}, remove: () => {}, removeAll: () => {},
    requestPermission: () => {},
  };
}
