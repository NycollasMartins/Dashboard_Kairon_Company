// ====================================================================
// Agregações financeiras (mês a mês + totais do ano), em JS sobre os
// dados brutos do Supabase (contratos, leads, campaign_metrics).
// ====================================================================

import { mrrDoCliente, getContratoAtivo } from '@/features/clientes/api/contratos.api';
import { RECEITA_POR_CONVERSAO } from '@/lib/adsConfig';

export const MES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Re-export do valor estimado por conversão (fonte única em @/lib/adsConfig),
// para os imports existentes (FinanceiroPage, relatórios) seguirem funcionando.
export { RECEITA_POR_CONVERSAO };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Parse de coluna SQL `date` ("YYYY-MM-DD") em horário LOCAL.
// new Date("YYYY-MM-DD") assume UTC; em UTC-3 isso retrocede ~3h e joga o
// dia 1º para o mês anterior (e 1º/jan para o ano anterior). Aqui montamos
// a data no fuso local (meia-noite), evitando o off-by-one.
// IMPORTANTE: use SÓ para colunas `date`. NÃO use em `created_at` (timestamptz).
export function parseDateLocal(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

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
  if (ct.status === 'cancelado' && ct.data_cancelamento) return parseDateLocal(ct.data_cancelamento) ?? now;
  if (ct.data_fim) return parseDateLocal(ct.data_fim) ?? now;
  return now;
}

// Série de MRR (recorrente) por mês do ano: um contrato MRR soma seu valor
// em todo mês que intersecta [data_inicio, fim do contrato].
export function mrrSeriesYear(contratos, year, now = new Date()) {
  const arr = new Array(12).fill(0);
  for (const ct of contratos) {
    if (ct.tipo !== 'MRR') continue;
    const ini = parseDateLocal(ct.data_inicio);
    if (!ini) continue;
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

// Nº de clientes distintos com contrato MRR ativo em cada mês do ano
// (denominador período-consistente do ticket médio).
export function mrrClientCountSeriesYear(contratos, year, now = new Date()) {
  const sets = Array.from({ length: 12 }, () => new Set());
  for (const ct of contratos) {
    if (ct.tipo !== 'MRR') continue;
    const ini = parseDateLocal(ct.data_inicio);
    if (!ini) continue;
    const fim = fimEfetivo(ct, now);
    const clienteId = ct._cliente?.id ?? ct.cliente_id;
    for (let m = 0; m < 12; m += 1) {
      const mStart = new Date(year, m, 1);
      const mEnd = new Date(year, m + 1, 0, 23, 59, 59);
      if (ini <= mEnd && fim >= mStart && clienteId) sets[m].add(clienteId);
    }
  }
  return sets.map((s) => s.size);
}

// Receita reconhecida por mês = MRR do mês + TCV (pontual) faturado no mês.
export function receitaSeriesYear(contratos, year, now = new Date()) {
  const arr = mrrSeriesYear(contratos, year, now).slice();
  for (const ct of contratos) {
    if (ct.tipo !== 'TCV') continue;
    // TCV cancelado não é receita — não entra na série (corrige receita inflada).
    if (ct.status === 'cancelado') continue;
    const d = parseDateLocal(ct.data_inicio);
    if (!d || d.getFullYear() !== year) continue;
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

// Gasto e conversões de anúncios por mês. Também o ROAS de mídia por mês
// (receita estimada por conversão ÷ gasto) — exposto na página.
export function adsSeriesYear(metrics, year) {
  const spend = new Array(12).fill(0);
  const conversions = new Array(12).fill(0);
  for (const m of metrics || []) {
    const d = parseDateLocal(m.date);
    if (!d || d.getFullYear() !== year) continue;
    spend[d.getMonth()] += num(m.spend);
    conversions[d.getMonth()] += num(m.conversions);
  }
  // ROAS = receita estimada (conversões × valor) ÷ gasto (múltiplo, ex.: 3.5×).
  const roas = spend.map((s, i) => (s > 0 ? (conversions[i] * RECEITA_POR_CONVERSAO) / s : 0));
  return { spend, conversions, roas };
}

// MRR ativo atual (snapshot) — soma do contrato MRR ativo de cada cliente.
// Inclui contratos já fechados E os que vão começar (início futuro): o que
// vale é o valor de contrato atribuído a cada cliente não-churn, sem recorte
// temporal de vigência do mês.
export function mrrAtual(clientes) {
  let total = 0;
  for (const c of clientes || []) {
    if (c.status === 'churn') continue;
    total += mrrDoCliente(c.contratos);
  }
  return total;
}

// TCV reconhecido NO MÊS — soma do valor dos contratos TCV (valor total único)
// cujo início (data_inicio) cai no mês/ano informado, de clientes não-churn.
// O TCV é receita pontual: entra só no mês em que o contrato fecha. Por isso a
// Receita do mês "reinicia" todo mês (volta a valer só o MRR) e só sobe quando
// entra um novo cliente TCV naquele mês.
export function tcvDoMes(clientes, year, month) {
  let total = 0;
  for (const c of clientes || []) {
    if (c.status === 'churn') continue;
    for (const ct of c.contratos || []) {
      if (ct.tipo !== 'TCV') continue;
      // Só TCV ATIVO conta como receita do mês. TCV cancelado/encerrado não entra
      // (era o bug: contratos TCV removidos seguiam somando na Receita do mês).
      if (ct.status !== 'ativo') continue;
      const d = parseDateLocal(ct.data_inicio);
      if (!d || d.getFullYear() !== year || d.getMonth() !== month) continue;
      total += num(ct.valor);
    }
  }
  return total;
}

// Nº de clientes não-churn com contrato atribuído (MRR ou TCV).
export function clientesComContrato(clientes) {
  let n = 0;
  for (const c of clientes || []) {
    if (c.status === 'churn') continue;
    if (getContratoAtivo(c.contratos)) n += 1;
  }
  return n;
}

// Monta os dados {mes, valor} para o gráfico a partir de uma série de 12.
export function toChartSeries(series) {
  return series.map((valor, i) => ({ mes: MES_LABELS[i], valor }));
}

export const sum = (arr) => (arr || []).reduce((a, b) => a + b, 0);

// No ANO CORRENTE, zera os meses FUTUROS (índices > mês atual) de uma série, para
// que receita e custo fiquem ambos "realizado até agora". Sem isso, o custo
// recorrente projeta até dezembro enquanto a receita só conta o realizado, o que
// distorcia ROI e Margem anuais (realizado vs projetado). Em anos fechados,
// retorna a série cheia.
export function cortarMesesFuturos(series, year, now = new Date()) {
  if (year !== now.getFullYear()) return (series || []).slice();
  const cm = now.getMonth();
  return (series || []).map((v, i) => (i > cm ? 0 : v));
}

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
    const comp = parseDateLocal(c.competencia);
    if (!comp) continue;
    const startYear = comp.getFullYear();
    const startMonth = comp.getMonth();
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
    .filter((c) => {
      if (c.status !== 'ativo') return false;
      const fim = parseDateLocal(c.data_fim);
      return fim && fim >= now && fim <= limite;
    })
    .sort((a, b) => parseDateLocal(a.data_fim) - parseDateLocal(b.data_fim));
}
