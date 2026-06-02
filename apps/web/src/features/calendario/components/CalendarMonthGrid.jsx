import { useMemo } from 'react';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, startOfDay, endOfDay, format,
} from 'date-fns';
import { Plus } from 'lucide-react';
import { eventTypeConfig } from '@/features/calendario/lib/eventConfig';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MAX_VISIBLE = 3;

// Um evento "ocorre" no dia se o intervalo [start,end] intersecta o dia.
function eventsOnDay(events, day) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return events.filter((ev) => {
    const s = new Date(ev.start_at);
    const e = new Date(ev.end_at);
    return s <= dayEnd && e >= dayStart;
  });
}

export default function CalendarMonthGrid({ month, events, canManage, onDayClick, onEventClick }) {
  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const today = new Date();

  return (
    <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-white/5 bg-white/[0.02]">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="px-2 py-2.5 text-[11px] uppercase tracking-wider font-medium text-muted-foreground text-center"
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          const dayEvents = eventsOnDay(events, day);
          const visible = dayEvents.slice(0, MAX_VISIBLE);
          const extra = dayEvents.length - visible.length;

          return (
            <div
              key={day.toISOString()}
              className={`group min-h-[104px] border-b border-r border-white/5 p-1.5 flex flex-col gap-1 transition-colors ${
                inMonth ? 'bg-transparent' : 'bg-white/[0.015]'
              } ${canManage ? 'cursor-pointer hover:bg-white/[0.03]' : ''}`}
              onClick={canManage ? () => onDayClick(day) : undefined}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs tabular-nums w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-[#EA3935] text-white font-semibold'
                      : inMonth
                        ? 'text-white/80'
                        : 'text-muted-foreground/40'
                  }`}
                >
                  {format(day, 'd')}
                </span>
                {canManage && (
                  <Plus className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
                )}
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                {visible.map((ev) => {
                  const cfg = eventTypeConfig(ev.type);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      title={ev.title}
                      className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md text-left ${cfg.soft} hover:brightness-125 transition`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className="text-[11px] leading-tight truncate text-white/90">
                        {ev.title}
                      </span>
                    </button>
                  );
                })}
                {extra > 0 && (
                  <span className="text-[10px] text-muted-foreground pl-1.5">+{extra} mais</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
