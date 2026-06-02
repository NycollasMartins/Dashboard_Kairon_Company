const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatBRL(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'R$ 0';
  return BRL.format(n);
}

export function formatDateBR(iso) {
  if (!iso) return '—';
  try {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return '—';
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  } catch {
    return '—';
  }
}

export function diasAteFim(dataFim) {
  if (!dataFim) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fim = new Date(`${String(dataFim).slice(0, 10)}T00:00:00`);
  const diff = Math.round((fim.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function statusContratoConfig(status) {
  switch (status) {
    case 'ativo':
      return { label: 'Ativo', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/25', dot: 'bg-emerald-400' };
    case 'expirado':
      return { label: 'Expirado', color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/25', dot: 'bg-amber-400' };
    case 'renovado':
      return { label: 'Renovado', color: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/25', dot: 'bg-blue-400' };
    case 'cancelado':
      return { label: 'Cancelado', color: 'text-red-300', bg: 'bg-red-500/10 border-red-500/25', dot: 'bg-red-400' };
    default:
      return { label: status || '—', color: 'text-slate-300', bg: 'bg-slate-500/10 border-slate-500/25', dot: 'bg-slate-400' };
  }
}
