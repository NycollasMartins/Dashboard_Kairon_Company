// Opções e helpers de apresentação das campanhas.

export const PLATFORM_OPTIONS = [
  { value: 'meta', label: 'Meta Ads', short: 'Meta' },
  { value: 'google', label: 'Google Ads', short: 'Google' },
];

export const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativa', dot: 'bg-emerald-400', color: 'text-emerald-300', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' },
  { value: 'paused', label: 'Pausada', dot: 'bg-amber-400', color: 'text-amber-300', badge: 'bg-amber-500/10 border-amber-500/20 text-amber-300' },
  { value: 'ended', label: 'Encerrada', dot: 'bg-slate-500', color: 'text-slate-300', badge: 'bg-slate-500/10 border-slate-500/20 text-slate-300' },
];

export const BUDGET_TYPE_OPTIONS = [
  { value: 'daily', label: 'Diário' },
  { value: 'lifetime', label: 'Total (lifetime)' },
];

export const OBJECTIVE_OPTIONS = [
  { value: 'awareness', label: 'Reconhecimento' },
  { value: 'traffic', label: 'Tráfego' },
  { value: 'engagement', label: 'Engajamento' },
  { value: 'leads', label: 'Geração de Leads' },
  { value: 'sales', label: 'Vendas / Conversões' },
  { value: 'app_promotion', label: 'Promoção de App' },
];

export const platformConfig = PLATFORM_OPTIONS.reduce((acc, p) => {
  acc[p.value] = p;
  return acc;
}, {});

export const statusConfig = STATUS_OPTIONS.reduce((acc, s) => {
  acc[s.value] = s;
  return acc;
}, {});

export const objectiveConfig = OBJECTIVE_OPTIONS.reduce((acc, o) => {
  acc[o.value] = o;
  return acc;
}, {});

export const platformBadge = {
  meta: 'bg-[#1877F2]/10 border-[#1877F2]/30 text-[#5b9cf5]',
  google: 'bg-[#34A853]/10 border-[#34A853]/30 text-[#5ec77e]',
};

export const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatBRL(value) {
  const n = Number(value);
  return Number.isFinite(n) ? BRL.format(n) : '—';
}

export function formatInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '0';
}
