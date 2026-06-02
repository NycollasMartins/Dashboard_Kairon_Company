import { Users, Activity, Package } from 'lucide-react';

// Tipos de evento + cores/badges no padrão visual do dashboard.
export const EVENT_TYPES = {
  meeting: {
    value: 'meeting',
    label: 'Reunião',
    icon: Users,
    dot: 'bg-blue-400',
    bar: 'bg-blue-500',
    chip: 'bg-blue-500/15 border border-blue-500/30 text-blue-300',
    soft: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
  },
  activity: {
    value: 'activity',
    label: 'Atividade',
    icon: Activity,
    dot: 'bg-amber-400',
    bar: 'bg-amber-500',
    chip: 'bg-amber-500/15 border border-amber-500/30 text-amber-300',
    soft: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  },
  delivery: {
    value: 'delivery',
    label: 'Entrega',
    icon: Package,
    dot: 'bg-emerald-400',
    bar: 'bg-emerald-500',
    chip: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300',
    soft: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  },
};

export const EVENT_TYPE_LIST = Object.values(EVENT_TYPES);

export function eventTypeConfig(type) {
  return EVENT_TYPES[type] ?? EVENT_TYPES.meeting;
}
