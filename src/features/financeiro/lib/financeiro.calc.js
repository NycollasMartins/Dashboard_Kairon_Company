// ====================================================================
// Agregações financeiras (mês a mês + totais do ano), em JS sobre os
// dados brutos do Supabase (contratos, leads, campaign_metrics).
// ====================================================================

import { mrrDoCliente } from '@/features/clientes/api/contratos.api';

export const MES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Valor estimado por conversão de anúncio (mesmo critério já usado em Campanhas).
export const RECEITA_POR_CONVERSAO = 80;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Achata os contratos de todos os clientes num array só.
export function flattenContratos(clientes) {
  const out = [];
  for (const c of clientes || []) {
    for (const ct of c.contratos || []) out.push({ ...ct, _cliente: c });
  }
  return out;
}

// Até quando o MRR do contrato vai: o TEMPO DE CONTRATO (data_inicio → data_fim)
// é o que define até onde o MRR do cliente é contabilizado. Se cancelado antes,
// vai só até a data de cancelamento.
function fimEfetivo(ct, now) {
  if (ct.status === 'cancelado' && ct.data_cancelamento) return new Date(ct.data_cancelamento);
  if (ct.data_fim) return new Date(ct.data_fim);
  return now;
}

// Série de MRR (recorrente) por mês do ano: um contrato MRR soma seu valor
// em todo mês que intersecta [data_inicio, fim do contrato].
export function mrrSeriesYear(contratos, year, now = new Date()) {
  const arr = new Array(12).fill(0);
  for (const ct of contratos) {
    if (ct.tipo !== 'MRR') continue;
    const ini = new Date(ct.data_inicio);
    const fim = fimEfetivo(ct, now);
    const val = num(ct.valor);
    for (let m = 0; m < 12; m += 1) {
      const mStart = new Date(year, m, 1);
      const mEnd = new Date(year, m + 1, 0, 23, 59, 59);
      if (ini <= mEnd && fim >= mStart) arr[m] += val;
    }
  }
  return arr;
}

// Receita reconhecida por mês = MRR do mês + TCV (pontual) faturado no mês.
export function receitaSeriesYear(contratos, year, now = new Date()) {
  const arr = mrrSeriesYear(contratos, year, now).slice();
  for (const ct of contratos) {
    if (ct.tipo !== 'TCV' || !ct.data_inicio) continue;
    const d = new Date(ct.data_inicio);
    if (d.getFullYear() !== year) continue;
    const val = ct.status === 'ativo' ? num(ct.valor) : num(ct.total_recebido || ct.valor);
    arr[d.getMonth()] += val;
  }
  return arr;
}

// Leads criados por mês.
export function leadsSeriesYear(leads, year) {
  const arr = new Array(12).fill(0);
  for (const l of leads || []) {
    if (!l.created_at) continue;
    const d = new Date(l.created_at);
    if (d.getFullYear() === year) arr[d.getMonth()] += 1;
  }
  return arr;
}

// Gasto e conversões de anúncios por mês.
export function adsSeriesYear(metrics, year) {
  const spend = new Array(12).fill(0);
  const conversions = new Array(12).fill(0);
  for (const m of metrics || []) {
    if (!m.date) continue;
    const d = new Date(m.date);
    if (d.getFullYear() !== year) continue;
    spend[d.getMonth()] += num(m.spend);
    conversions[d.getMonth()] += num(m.conversions);
  }
  const roi = spend.map((s, i) => {
    const receita = conversions[i] * RECEITA_POR_CONVERSAO;
    return s > 0 ? ((receita - s) / s) * 100 : 0;
  });
  return { spend, conversions, roi };
}

// MRR ativo atual (snapshot) — soma do contrato MRR ativo de cada cliente.
export function mrrAtual(clientes) {
  let total = 0;
  for (const c of clientes || []) {
    if (c.status === 'churn') continue;
    total += mrrDoCliente(c.contratos);
  }
  return total;
}

// Monta os dados {mes, valor} para o gráfico a partir de uma série de 12.
export function toChartSeries(series) {
  return series.map((valor, i) => ({ mes: MES_LABELS[i], valor }));
}

export const sum = (arr) => (arr || []).reduce((a, b) => a + b, 0);

// Clientes novos (created_at) por mês do ano.
export function novosClientesSeriesYear(clientes, year) {
  const arr = new Array(12).fill(0);
  for (const c of clientes || []) {
    if (!c.created_at) continue;
    const d = new Date(c.created_at);
    if (d.getFullYear() === year) arr[d.getMonth()] += 1;
  }
  return arr;
}

// Custos operacionais por mês: pontual entra só no mês de competência;
// recorrente entra em todo mês a partir da competência (até o mês atual).
export function custoOperacionalSeriesYear(custos, year) {
  const arr = new Array(12).fill(0);
  for (const c of custos || []) {
    if (!c.competencia) continue;
    // Parse local (evita o off-by-one de fuso ao usar new Date('YYYY-MM-DD')).
    const [startYear, mm] = String(c.competencia).slice(0, 10).split('-').map(Number);
    const startMonth = mm - 1;
    const val = num(c.amount);
    if (c.recurring) {
      // Recorrente conta de janeiro a dezembro do ano (a partir do mês de início,
      // se começou neste mesmo ano). Anos seguintes herdam automaticamente.
      for (let m = 0; m < 12; m += 1) {
        const aplica = year > startYear || (year === startYear && m >= startMonth);
        if (aplica) arr[m] += val;
      }
    } else if (startYear === year) {
      // Custo único entra na despesa do mês de competência (mês em que foi lançado).
      arr[startMonth] += val;
    }
  }
  return arr;
}

// Contratos ativos a vencer dentro de N dias.
export function contratosAVencer(contratos, dias = 30, now = new Date()) {
  const limite = new Date(now);
  limite.setDate(limite.getDate() + dias);
  return contratos
    .filter((c) => c.status === 'ativo' && c.data_fim && new Date(c.data_fim) >= now && new Date(c.data_fim) <= limite)
    .sort((a, b) => new Date(a.data_fim) - new Date(b.data_fim));
}
