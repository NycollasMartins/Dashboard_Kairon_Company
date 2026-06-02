import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Edit2, Trash2, MapPin, AlignLeft, CalendarDays,
  Users as UsersIcon, Layers, UserCircle2, Crown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { eventTypeConfig } from '@/features/calendario/lib/eventConfig';
import { formatEventTime } from '@/features/calendario/lib/datetime';

export default function EventoDetalhe({ event, canManage, onClose, onEdit, onDelete }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!event) return null;
  const cfg = eventTypeConfig(event.type);
  const TypeIcon = cfg.icon;

  const audience = (() => {
    if (event.audience_type === 'clevel') {
      return { Icon: Crown, text: 'Somente C-levels (admin)' };
    }
    if (event.audience_type === 'squad') {
      return { Icon: Layers, text: `Squad ${event.squad?.nome ?? '—'}` };
    }
    if (event.audience_type === 'user') {
      const nomes = (event.attendees || [])
        .map((a) => a.profile?.full_name || a.profile?.email)
        .filter(Boolean);
      const texto = nomes.length
        ? nomes.join(', ')
        : (event.assignee?.full_name || event.assignee?.email || '—');
      return { Icon: UserCircle2, text: texto };
    }
    return { Icon: UsersIcon, text: 'Todos no dashboard' };
  })();
  const AudienceIcon = audience.Icon;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative glass-card border border-white/10 rounded-2xl w-full max-w-md z-10 shadow-2xl shadow-black/40"
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.soft}`}>
              <TypeIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md ${cfg.chip}`}>
                {cfg.label}
              </span>
              <h3 className="text-base font-semibold text-white leading-snug mt-1.5 break-words">
                {event.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3.5 text-sm">
          <div className="flex items-center gap-2.5 text-white/90">
            <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>{formatEventTime(event)}</span>
          </div>
          <div className="flex items-center gap-2.5 text-white/90">
            <AudienceIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>{audience.text}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2.5 text-white/90">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="break-words">{event.location}</span>
            </div>
          )}
          {event.description && (
            <div className="flex items-start gap-2.5 text-white/80">
              <AlignLeft className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="whitespace-pre-wrap break-words">{event.description}</p>
            </div>
          )}
          {event.google_event_id && (
            <p className="text-[11px] text-muted-foreground/70 pt-1">Sincronizado com o Google Calendar.</p>
          )}
        </div>

        {canManage && (
          <div className="flex items-center gap-3 px-6 pb-5 pt-1">
            <Button
              type="button"
              onClick={() => onEdit(event)}
              variant="outline"
              className="flex-1 border-white/10 bg-transparent text-white hover:bg-white/5 h-10"
            >
              <Edit2 className="w-4 h-4 mr-1.5" /> Editar
            </Button>
            <Button
              type="button"
              onClick={() => onDelete(event)}
              className="flex-1 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 h-10"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
