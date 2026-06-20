// ====================================================================
// MÓDULO ÚNICO DE CÁLCULO FINANCEIRO (@kairon/core/finance/finance.calc)
//
// Fonte ÚNICA de toda a lógica financeira da agência. Financeiro, Metas,
// Relatórios e Squads importam daqui — o mesmo cálculo nunca diverge entre
// telas. Funções puras sobre os dados brutos do Supabase:
//   contratos, clientes, vendas, contrato_parcelas, operational_costs,
//   campaign_metrics, leads, finance_config.
//
// PREMISSAS DE RECONHECIMENTO (decididas com o cliente):
//  • MRR  -> reconhecido 1×/mês ao longo da vigência [data_inicio, data_fim].
//  • TCV  -> 100% no mês do fechamento (data_inicio) por padrão (regime "caixa").
//            Há também a visão LINEAR (competência) como alternativa.
//  • CAIXA real -> parcelas pagas (contrato_parcelas.pago_em).
//  • Receita do mês (igual à aba Metas) = MRR ativo + TCV do mês + vendas avulsas.
// ====================================================================

import { mrrDoCliente, tcvHistorico, ltvEstimado, getContratoAtivo } from '../api/contratos.api.js';

// Re-exporta os primitivos por-cliente (continuam sendo a fonte única deles).
export { mrrDoCliente, tcvHistorico, ltvEstimado, getContratoAtivo };

export const MES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Receita estimada por conversão (proxy de ROAS). Default 80; o app pode
// sobrescrever passando o valor (evita import.meta.env dentro do core).
export const RECEITA_POR_CONVERSAO_DEFAULT = 80;

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
export const sum = (arr) => (arr || []).reduce((a, b) => a + num(b), 0);
const safeDiv = (a, b) => (num(b) !== 0 ? num(a) / num(b) : 0);

// Parse de coluna SQL `date` ("YYYY-MM-DD") em horário LOCAL (evita o
// off-by-one de new Date("YYYY-MM-DD"), que assume UTC). Use só em colunas
// `date`, NUNCA em `created_at`/`pago_em`-timestamp.
export function parseDateLocal(s) {
  if (!s) return null;
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Achata os contratos de todos os clientes num array só (com _cliente).
export function flattenContratos(clientes) {
  const out = [];
  for (const c of clientes || []) {
    for (const ct of c.contratos || []) out.push({ ...ct, _cliente: c });
  }
  return out;
}

// Até quando o MRR do contrato é contabilizado: a vigência (data_inicio →
// data_fim); se cancelado antes, vai só até a data de cancelamento.
function fimEfetivo(ct, now) {
  if (ct.status === 'cancelado' && ct.data_cancelamento) return parseDateLocal(ct.data_cancelamento) ?? now;
  if (ct.data_fim) return parseDateLocal(ct.data_fim) ?? now;
  return now;
}

// Um contrato MRR está vigente no mês (year, m)?
function mrrVigenteNoMes(ct, year, m, now) {
  if (ct.tipo !== 'MRR') return false;
  const ini = parseDateLocal(ct.data_inicio);
  if (!ini) return false;
  const fim = fimEfetivo(ct, now);
  const mStart = new Date(year, m, 1);
  const mEnd = new Date(year, m + 1, 0, 23, 59, 59);
  return ini <= mEnd && fim >= mStart;
}

// ====================================================================
// SÉRIES MÊS A MÊS (competência / vigência)
// ====================================================================

// Série de MRR (recorrente) por mês: contrato MRR soma seu valor em todo mês
// que intersecta [data_inicio, fim efetivo].
export function mrrSeriesYear(contratos, year, now = new Date()) {
  const arr = new Array(12).fill(0);
  for (const ct of contratos) {
    if (ct.tipo !== 'MRR') continue;
    const val = num(ct.valor);
    for (let m = 0; m < 12; m += 1) if (mrrVigenteNoMes(ct, year, m, now)) arr[m] += val;
  }
  return arr;
}

// Nº de clientes distintos com MRR ativo em cada mês (denominador do ticket).
export function mrrClientCountSeriesYear(contratos, year, now = new Date()) {
  const sets = Array.from({ length: 12 }, () => new Set());
  for (const ct of contratos) {
    if (ct.tipo !== 'MRR') continue;
    const clienteId = ct._cliente?.id ?? ct.cliente_id;
    if (!clienteId) continue;
    for (let m = 0; m < 12; m += 1) if (mrrVigenteNoMes(ct, year, m, now)) sets[m].add(clienteId);
  }
  return sets.map((s) => s.size);
}

// Receita reconhecida por mês (competência) = MRR do mês + TCV no mês.
//  modoTcv='caixa'      -> TCV 100% no mês do data_inicio (padrão).
//  modoTcv='linear'     -> TCV diluído igualmente ao longo de [inicio, fim].
export function receitaSeriesYear(contratos, year, now = new Date(), modoTcv = 'caixa') {
  const arr = mrrSeriesYear(contratos, year, now).slice();
  for (const ct of contratos) {
    if (ct.tipo !== 'TCV') continue;
    if (ct.status === 'cancelado') continue; // TCV cancelado não é receita
    const ini = parseDateLocal(ct.data_inicio);
    if (!ini) continue;
    const val = ct.status === 'ativo' ? num(ct.valor) : num(ct.total_recebido || ct.valor);
    if (modoTcv === 'linear') {
      // Dilui o valor pelos meses de vigência; soma a fração que cai no `year`.
      const meses = Math.max(1, num(ct.duracao_meses) || 1);
      const fatia = val / meses;
      for (let k = 0; k < meses; k += 1) {
        const d = new Date(ini.getFullYear(), ini.getMonth() + k, 1);
        if (d.getFullYear() === year) arr[d.getMonth()] += fatia;
      }
    } else if (ini.getFullYear() === year) {
      arr[ini.getMonth()] += val; // caixa: tudo no mês do fechamento
    }
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

// Clientes novos (created_at) por mês.
export function novosClientesSeriesYear(clientes, year) {
  const arr = new Array(12).fill(0);
  for (const c of clientes || []) {
    if (!c.created_at) continue;
    const d = new Date(c.created_at);
    if (d.getFullYear() === year) arr[d.getMonth()] += 1;
  }
  return arr;
}

// Gasto e conversões de anúncios por mês, e o ROAS de mídia por mês.
export function adsSeriesYear(metrics, year, receitaPorConversao = RECEITA_POR_CONVERSAO_DEFAULT) {
  const spend = new Array(12).fill(0);
  const conversions = new Array(12).fill(0);
  for (const m of metrics || []) {
    const d = parseDateLocal(m.date);
    if (!d || d.getFullYear() !== year) continue;
    spend[d.getMonth()] += num(m.spend);
    conversions[d.getMonth()] += num(m.conversions);
  }
  const roas = spend.map((s, i) => (s > 0 ? (conversions[i] * receitaPorConversao) / s : 0));
  return { spend, conversions, roas };
}

// Custos operacionais por mês: pontual no mês de competência; recorrente em
// todo mês a partir da competência.
export function custoOperacionalSeriesYear(custos, year) {
  const arr = new Array(12).fill(0);
  for (const c of custos || []) {
    const comp = parseDateLocal(c.competencia);
    if (!comp) continue;
    const startYear = comp.getFullYear();
    const startMonth = comp.getMonth();
    const val = num(c.amount);
    if (c.recurring) {
      for (let m = 0; m < 12; m += 1) {
        if (year > startYear || (year === startYear && m >= startMonth)) arr[m] += val;
      }
    } else if (startYear === year) {
      arr[startMonth] += val;
    }
  }
  return arr;
}

// No ANO CORRENTE, zera os meses FUTUROS de uma série (realizado até agora).
export function cortarMesesFuturos(series, year, now = new Date()) {
  if (year !== now.getFullYear()) return (series || []).slice();
  const cm = now.getMonth();
  return (series || []).map((v, i) => (i > cm ? 0 : v));
}

export function toChartSeries(series) {
  return (series || []).map((valor, i) => ({ mes: MES_LABELS[i], valor }));
}

// ====================================================================
// SNAPSHOTS DO MÊS (iguais aos das Metas)
// ====================================================================

// MRR ativo atual (snapshot) — soma do contrato MRR ativo de cada cliente
// não-churn. Mesmo número do RPC mrr_base_ativo (Metas).
export function mrrAtual(clientes) {
  let total = 0;
  for (const c of clientes || []) {
    if (c.status === 'churn') continue;
    total += mrrDoCliente(c.contratos);
  }
  return total;
}

// TCV reconhecido NO MÊS — soma do valor dos contratos TCV ATIVOS cujo
// data_inicio cai no mês/ano, de clientes não-churn. Igual ao RPC tcv_mes_ativo.
export function tcvDoMes(clientes, year, month) {
  let total = 0;
  for (const c of clientes || []) {
    if (c.status === 'churn') continue;
    for (const ct of c.contratos || []) {
      if (ct.tipo !== 'TCV' || ct.status !== 'ativo') continue;
      const d = parseDateLocal(ct.data_inicio);
      if (!d || d.getFullYear() !== year || d.getMonth() !== month) continue;
      total += num(ct.valor);
    }
  }
  return total;
}

// Vendas AVULSAS (sem contrato) do mês — entram no "feito" das Metas e, para
// bater com o Financeiro, também na Receita do mês. data_venda é coluna `date`.
export function vendasAvulsasDoMes(vendas, year, month) {
  let total = 0;
  for (const v of vendas || []) {
    if (v.contrato_id) continue; // só avulsas (contrato já entra via MRR/TCV)
    const d = parseDateLocal(v.data_venda);
    if (!d || d.getFullYear() !== year || d.getMonth() !== month) continue;
    total += num(v.valor);
  }
  return total;
}

// RECEITA DO MÊS unificada (idêntica ao "feito" da aba Metas):
//   MRR ativo (snapshot) + TCV do mês + vendas avulsas do mês.
export function receitaDoMes(clientes, vendas, year, month) {
  return mrrAtual(clientes) + tcvDoMes(clientes, year, month) + vendasAvulsasDoMes(vendas, year, month);
}

// Nº de clientes não-churn com contrato atribuído.
export function clientesComContrato(clientes) {
  let n = 0;
  for (const c of clientes || []) {
    if (c.status === 'churn') continue;
    if (getContratoAtivo(c.contratos)) n += 1;
  }
  return n;
}

// Contratos ativos a vencer dentro de N dias.
export function contratosAVencer(contratos, dias = 30, now = new Date()) {
  const limite = new Date(now);
  limite.setDate(limite.getDate() + dias);
  return (contratos || [])
    .filter((c) => {
      if (c.status !== 'ativo') return false;
      const fim = parseDateLocal(c.data_fim);
      return fim && fim >= now && fim <= limite;
    })
    .sort((a, b) => parseDateLocal(a.data_fim) - parseDateLocal(b.data_fim));
}

// ====================================================================
// MRR MOVEMENTS / CHURN / NRR / GRR
// ====================================================================

// MRR por cliente no mês (year, m): Map(clienteId -> valor MRR vigente).
export function mrrByClientAtMonth(contratos, year, m, now = new Date()) {
  const map = new Map();
  for (const ct of contratos) {
    if (ct.tipo !== 'MRR') continue;
    if (!mrrVigenteNoMes(ct, year, m, now)) continue;
    const id = ct._cliente?.id ?? ct.cliente_id;
    if (!id) continue;
    map.set(id, (map.get(id) || 0) + num(ct.valor));
  }
  return map;
}

// Movimentos de MRR de um mês vs o mês anterior, por cliente:
//   new        = cliente que não tinha MRR e passou a ter
//   expansion  = aumento de MRR de cliente existente
//   contraction= redução de MRR de cliente existente (sem zerar)
//   churned    = cliente que tinha MRR e zerou
export function mrrMovementsAtMonth(contratos, year, m, now = new Date()) {
  const prevDate = new Date(year, m - 1, 1);
  const cur = mrrByClientAtMonth(contratos, year, m, now);
  const prev = mrrByClientAtMonth(contratos, prevDate.getFullYear(), prevDate.getMonth(), now);
  let novo = 0; let expansion = 0; let contraction = 0; let churned = 0;
  const ids = new Set([...cur.keys(), ...prev.keys()]);
  for (const id of ids) {
    const p = prev.get(id) || 0;
    const c = cur.get(id) || 0;
    if (p === 0 && c > 0) novo += c;
    else if (p > 0 && c === 0) churned += p;
    else if (c > p) expansion += c - p;
    else if (c < p) contraction += p - c;
  }
  const net = novo + expansion - contraction - churned;
  return { novo, expansion, contraction, churned, net };
}

// Série anual de movements (12 meses).
export function mrrMovementsYear(contratos, year, now = new Date()) {
  return Array.from({ length: 12 }, (_, m) => mrrMovementsAtMonth(contratos, year, m, now));
}

// Churn de clientes (logo churn) num mês: clientes que viraram churn no mês ÷
// base de clientes ativos no início do mês. Usa clientes.churned_at.
export function logoChurnMes(clientes, year, month) {
  const inicioMes = new Date(year, month, 1);
  let churnedNoMes = 0;
  let ativosInicio = 0;
  for (const c of clientes || []) {
    const churnedAt = c.churned_at ? new Date(c.churned_at) : null;
    const criadoAt = c.created_at ? new Date(c.created_at) : null;
    // ativo no início do mês = criado antes do mês e (não churnou OU churnou depois do início)
    if (criadoAt && criadoAt < inicioMes && (!churnedAt || churnedAt >= inicioMes)) ativosInicio += 1;
    if (churnedAt && churnedAt.getFullYear() === year && churnedAt.getMonth() === month) churnedNoMes += 1;
  }
  return { churnedNoMes, ativosInicio, pct: safeDiv(churnedNoMes, ativosInicio) * 100 };
}

// MRR churn % do mês = MRR perdido (churned + contraction) ÷ MRR do início do mês.
export function mrrChurnMes(contratos, year, month, now = new Date()) {
  const mov = mrrMovementsAtMonth(contratos, year, month, now);
  const prevDate = new Date(year, month - 1, 1);
  const baseInicio = sum(Array.from(mrrByClientAtMonth(contratos, prevDate.getFullYear(), prevDate.getMonth(), now).values()));
  const perdido = mov.churned + mov.contraction;
  return { perdido, baseInicio, pct: safeDiv(perdido, baseInicio) * 100 };
}

// NRR e GRR de um período [mesInicio..mesFim] do mesmo ano (year-to-date por
// padrão). Compara a base do mês inicial com o que sobrou/expandiu no fim.
//   GRR = (base − churned − contraction) / base       (só perdas)
//   NRR = (base − churned − contraction + expansion) / base
export function nrrGrrPeriodo(contratos, year, mesInicio, mesFim, now = new Date()) {
  const baseMap = mrrByClientAtMonth(contratos, year, mesInicio, now);
  const fimMap = mrrByClientAtMonth(contratos, year, mesFim, now);
  const base = sum(Array.from(baseMap.values()));
  let churned = 0; let contraction = 0; let expansion = 0;
  for (const [id, p] of baseMap) {
    const c = fimMap.get(id) || 0;
    if (c === 0) churned += p;
    else if (c < p) contraction += p - c;
    else if (c > p) expansion += c - p;
  }
  const grr = safeDiv(base - churned - contraction, base) * 100;
  const nrr = safeDiv(base - churned - contraction + expansion, base) * 100;
  return { base, churned, contraction, expansion, grr, nrr };
}

// LTV médio e tempo médio de permanência (meses) da carteira.
//   LTV por cliente = ltvEstimado(contratos do cliente).
//   Permanência: churned -> churned_at−created_at; ativo -> now−created_at.
export function ltvECarteira(clientes, now = new Date()) {
  let somaLtv = 0; let nLtv = 0; let somaMeses = 0; let nMeses = 0;
  for (const c of clientes || []) {
    const ltv = ltvEstimado(c.contratos);
    if (ltv > 0) { somaLtv += ltv; nLtv += 1; }
    const ini = c.created_at ? new Date(c.created_at) : null;
    const fim = c.churned_at ? new Date(c.churned_at) : now;
    if (ini) { somaMeses += Math.max(0, (fim - ini) / (1000 * 60 * 60 * 24 * 30.44)); nMeses += 1; }
  }
  return { ltvMedio: safeDiv(somaLtv, nLtv), permanenciaMeses: safeDiv(somaMeses, nMeses) };
}

// ====================================================================
// AQUISIÇÃO: CAC / LTV:CAC / PAYBACK
// ====================================================================

// Custo de marketing (aquisição) por mês: gasto em ads + custos da categoria
// 'marketing'. (Custos de closer não estão em operational_costs hoje.)
export function custoAquisicaoSeriesYear(custos, metrics, year) {
  const ads = adsSeriesYear(metrics, year).spend;
  const mkt = new Array(12).fill(0);
  for (const c of custos || []) {
    if (c.category !== 'marketing') continue;
    const comp = parseDateLocal(c.competencia);
    if (!comp) continue;
    const val = num(c.amount);
    if (c.recurring) {
      for (let m = 0; m < 12; m += 1) {
        if (year > comp.getFullYear() || (year === comp.getFullYear() && m >= comp.getMonth())) mkt[m] += val;
      }
    } else if (comp.getFullYear() === year) {
      mkt[comp.getMonth()] += val;
    }
  }
  return ads.map((a, i) => a + mkt[i]);
}

// CAC do período = custo de aquisição ÷ novos clientes. ltvCac e payback (meses).
export function cacPeriodo({ custos, metrics, clientes, year, mesInicio = 0, mesFim = 11, now = new Date() }) {
  const aquis = custoAquisicaoSeriesYear(custos, metrics, year);
  const novos = novosClientesSeriesYear(clientes, year);
  let custoAq = 0; let nNovos = 0;
  for (let m = mesInicio; m <= mesFim; m += 1) { custoAq += aquis[m]; nNovos += novos[m]; }
  const cac = safeDiv(custoAq, nNovos);
  const { ltvMedio } = ltvECarteira(clientes, now);
  const ticketMrr = safeDiv(mrrAtual(clientes), Math.max(1, clientesComContrato(clientes)));
  return {
    custoAquisicao: custoAq,
    novosClientes: nNovos,
    cac,
    ltvMedio,
    ltvCac: safeDiv(ltvMedio, cac),
    paybackMeses: safeDiv(cac, ticketMrr), // meses de MRR para pagar o CAC
  };
}

// ====================================================================
// RECEBÍVEIS / CAIXA REAL (tabela contrato_parcelas)
// ====================================================================

const parcelaPaga = (p) => p.pago_em != null && p.status === 'pago';

// Caixa recebido por mês do ano (entradas reais = parcelas pagas no mês).
export function caixaRecebidoSeriesYear(parcelas, year) {
  const arr = new Array(12).fill(0);
  for (const p of parcelas || []) {
    if (!parcelaPaga(p)) continue;
    const d = parseDateLocal(p.pago_em);
    if (!d || d.getFullYear() !== year) continue;
    arr[d.getMonth()] += num(p.valor);
  }
  return arr;
}

// Recebíveis em aberto e inadimplência (parcelas não pagas).
//   inadimplência = parcelas em aberto com vencimento < hoje.
//   a vencer      = parcelas em aberto com vencimento >= hoje.
//   inadimplência% = vencido em aberto ÷ (vencido em aberto + já pago vencido).
export function recebiveis(parcelas, now = new Date()) {
  let aberto = 0; let vencidoAberto = 0; let aVencer = 0; let pagoVencido = 0;
  for (const p of parcelas || []) {
    const venc = parseDateLocal(p.vencimento);
    if (parcelaPaga(p)) {
      if (venc && venc < now) pagoVencido += num(p.valor);
      continue;
    }
    if (p.status === 'estornado' || p.status === 'falhou') continue;
    const v = num(p.valor);
    aberto += v;
    if (venc && venc < now) vencidoAberto += v; else aVencer += v;
  }
  const baseDevida = vencidoAberto + pagoVencido;
  return {
    emAberto: aberto,
    inadimplencia: vencidoAberto,
    aVencer,
    inadimplenciaPct: safeDiv(vencidoAberto, baseDevida) * 100,
  };
}

// Cronograma de contas a receber: parcelas em aberto agrupadas por competência
// (mês), ordenadas. Retorna [{ competencia, valor, qtd }].
export function cronogramaReceber(parcelas, now = new Date(), meses = 12) {
  const map = new Map();
  for (const p of parcelas || []) {
    if (parcelaPaga(p) || p.status === 'estornado' || p.status === 'falhou') continue;
    const comp = String(p.competencia).slice(0, 7); // YYYY-MM
    const cur = map.get(comp) || { competencia: comp, valor: 0, qtd: 0 };
    cur.valor += num(p.valor); cur.qtd += 1;
    map.set(comp, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.competencia.localeCompare(b.competencia)).slice(0, meses);
}

// Fluxo de caixa por mês = entradas (parcelas pagas) − saídas (custos + ads).
export function fluxoCaixaSeriesYear(parcelas, custos, metrics, year) {
  const entradas = caixaRecebidoSeriesYear(parcelas, year);
  const custoOp = custoOperacionalSeriesYear(custos, year);
  const ads = adsSeriesYear(metrics, year).spend;
  const saidas = custoOp.map((c, i) => c + ads[i]);
  const fluxo = entradas.map((e, i) => e - saidas[i]);
  return { entradas, saidas, fluxo };
}

// Saldo de caixa ABSOLUTO acumulado: saldo_inicial + Σ(entradas − saídas) a
// partir de saldo_inicial_data. Retorna a série acumulada (12) e o saldo atual.
export function saldoCaixa({ parcelas, custos, metrics, saldoInicial = 0, saldoInicialData = null, year, now = new Date() }) {
  const { fluxo } = fluxoCaixaSeriesYear(parcelas, custos, metrics, year);
  const dataRef = saldoInicialData ? parseDateLocal(saldoInicialData) : null;
  const acumulada = new Array(12).fill(0);
  let acc = num(saldoInicial);
  for (let m = 0; m < 12; m += 1) {
    // Só acumula a partir do mês da data do saldo inicial (no ano dela).
    const aplica = !dataRef || year > dataRef.getFullYear() || (year === dataRef.getFullYear() && m >= dataRef.getMonth());
    if (aplica) acc += fluxo[m];
    acumulada[m] = acc;
  }
  const cm = (year === now.getFullYear()) ? now.getMonth() : 11;
  return { serie: acumulada, saldoAtual: acumulada[cm] };
}

// ====================================================================
// DRE SIMPLIFICADO / MARGEM
// ====================================================================

// DRE do período (competência): receita − custos por categoria = lucro.
//   receita: regime escolhido (caixa/competência) via receitaSeries.
export function drePeriodo({ contratos, custos, metrics, year, mesInicio = 0, mesFim = 11, modoTcv = 'caixa', now = new Date() }) {
  const receitaS = receitaSeriesYear(contratos, year, now, modoTcv);
  const adsS = adsSeriesYear(metrics, year).spend;
  const catTotais = {};
  for (const c of custos || []) {
    const comp = parseDateLocal(c.competencia);
    if (!comp) continue;
    const val = num(c.amount);
    for (let m = mesInicio; m <= mesFim; m += 1) {
      const aplica = c.recurring
        ? (year > comp.getFullYear() || (year === comp.getFullYear() && m >= comp.getMonth()))
        : (comp.getFullYear() === year && comp.getMonth() === m);
      if (aplica) catTotais[c.category] = (catTotais[c.category] || 0) + val;
    }
  }
  let receita = 0; let ads = 0;
  for (let m = mesInicio; m <= mesFim; m += 1) { receita += receitaS[m]; ads += adsS[m]; }
  const custoOp = Object.values(catTotais).reduce((a, b) => a + b, 0);
  const custoTotal = custoOp + ads;
  const lucro = receita - custoTotal;
  return {
    receita,
    ads,
    custoOperacional: custoOp,
    custosPorCategoria: catTotais,
    custoTotal,
    lucro,
    margemPct: safeDiv(lucro, receita) * 100,
  };
}

// Mix da carteira (previsibilidade): % do faturamento do ano que é recorrente.
export function mixCarteira(contratos, year, now = new Date(), modoTcv = 'caixa') {
  const mrr = sum(mrrSeriesYear(contratos, year, now));
  const total = sum(receitaSeriesYear(contratos, year, now, modoTcv));
  const tcv = Math.max(0, total - mrr);
  return { mrr, tcv, total, pctRecorrente: safeDiv(mrr, total) * 100, pctPontual: safeDiv(tcv, total) * 100 };
}

// ====================================================================
// PROJEÇÃO (próximos meses)
// ====================================================================

// MRR contratado projetado para os próximos N meses (base previsível): soma do
// MRR vigente em cada mês futuro a partir dos contratos ativos.
export function projecaoMrr(contratos, meses = 6, now = new Date()) {
  const out = [];
  for (let k = 1; k <= meses; k += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() + k, 1);
    let total = 0;
    for (const ct of contratos) {
      if (ct.tipo !== 'MRR') continue;
      if (mrrVigenteNoMes(ct, d.getFullYear(), d.getMonth(), now)) total += num(ct.valor);
    }
    out.push({ ano: d.getFullYear(), mes: d.getMonth(), label: MES_LABELS[d.getMonth()], mrr: total });
  }
  return out;
}

// Ponto de equilíbrio (break-even) mensal: custo fixo mensal ÷ (1 − 0) ≈ custo
// total mensal recorrente. Aqui: receita mínima p/ lucro 0 = custos do mês.
export function breakEvenMensal(custos, metrics, year, month) {
  const custoOp = custoOperacionalSeriesYear(custos, year)[month] || 0;
  const ads = adsSeriesYear(metrics, year).spend[month] || 0;
  return custoOp + ads;
}
