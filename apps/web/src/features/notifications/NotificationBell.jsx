import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, Trash2, TrendingUp, CalendarClock, Info, CheckCheck, Trophy } from 'lucide-react';
import { useNotifications } from '@/features/notifications/NotificationsContext';

function tempoRelativo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

const typeIcon = { lead: TrendingUp, event: CalendarClock, meta: Trophy };

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead, remove, requestPermission } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) requestPermission();
  };

  const abrir = (n) => {
    if (!n.read_at) markRead(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={toggle}
        title="Notificações"
        className="relative w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/5 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EA3935] text-white text-[10px] font-bold flex items-center justify-center shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 max-w-[88vw] bg-[#16161d] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <p className="text-sm font-semibold text-white">Notificações</p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-white transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma notificação.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {notifications.map((n) => {
                    const Icon = typeIcon[n.type] ?? Info;
                    return (
                      <div
                        key={n.id}
                        className={`group flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-white/[0.05] ${n.read_at ? '' : 'bg-[#EA3935]/[0.12]'}`}
                        onClick={() => abrir(n)}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.type === 'lead' ? 'bg-emerald-500/10 text-emerald-300' : n.type === 'event' ? 'bg-blue-500/10 text-blue-300' : n.type === 'meta' ? 'bg-amber-500/10 text-amber-300' : 'bg-white/5 text-muted-foreground'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-white truncate">{n.title}</p>
                            {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-[#EA3935] shrink-0" />}
                          </div>
                          {n.body && <p className="text-xs text-white/70 truncate">{n.body}</p>}
                          <p className="text-[10px] text-white/45 mt-0.5">{tempoRelativo(n.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {!n.read_at && (
                            <button type="button" onClick={() => markRead(n.id)} title="Marcar como lida" className="p-1 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-white hover:bg-white/10 transition-colors">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button type="button" onClick={() => remove(n.id)} title="Remover" className="p-1 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-red-300 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
