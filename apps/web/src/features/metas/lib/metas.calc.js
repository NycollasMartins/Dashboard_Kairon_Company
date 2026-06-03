// Cálculos da aba Metas (progresso da meta, ranking de closers).

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function progressoPct(total, meta) {
  const m = num(meta);
  if (m <= 0) return 0;
  return (num(total) / m) * 100;
}

export function faltaParaMeta(total, meta) {
  return Math.max(0, num(meta) - num(total));
}

export function metaBatida(total, meta) {
  const m = num(meta);
  return m > 0 && num(total) >= m;
}

// Monta o ranking de closers a partir da lista de closers e das vendas do mês,
// já com a meta individual de cada um anexada. Ordena por total vendido (desc).
export function montarRanking({ closers = [], vendas = [], metas = [], competencia }) {
  const byId = new Map();
  for (const c of closers) {
    byId.set(c.id, { id: c.id, nome: c.full_name || 'Closer', email: c.email, total: 0, count: 0, meta: 0 });
  }
  for (const v of vendas) {
    const id = v.closer_id;
    if (!id) continue;
    if (!byId.has(id)) {
      byId.set(id, { id, nome: v.closer?.full_name || 'Closer', email: v.closer?.email, total: 0, count: 0, meta: 0 });
    }
    const e = byId.get(id);
    e.total += num(v.valor);
    e.count += 1;
  }
  for (const e of byId.values()) {
    const mi = metas.find((m) => m.usuario_id === e.id && m.competencia === competencia);
    e.meta = num(mi?.valor_meta);
  }
  return Array.from(byId.values()).sort((a, b) => b.total - a.total);
}

export const MES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function rotuloCompetencia(competencia) {
  const [y, m] = String(competencia).slice(0, 7).split('-').map(Number);
  if (!y || !m) return '';
  return `${MES_NOMES[m - 1]} de ${y}`;
}
