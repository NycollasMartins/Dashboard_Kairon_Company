// ====================================================================
// Consolida os dados de TODO o dashboard num único objeto compacto que é
// enviado à Edge Function `generate-report` (que repassa ao Claude).
// Reaproveita os cálculos do Financeiro e das Metas para manter os números
// idênticos aos exibidos nas respectivas abas.
// ====================================================================

import {
  flattenContratos, receitaSeriesYear, mrrSeriesYear, leadsSeriesYear, adsSeriesYear,
  novosClientesSeriesYear, custoOperacionalSeriesYear, contratosAVencer, parseDateLocal, sum,
  mrrAtual, tcvDoMes, clientesComContrato, RECEITA_POR_CONVERSAO, MES_LABELS,
} from '@/features/financeiro/lib/financeiro.calc';
import { mrrDoCliente } from '@/features/clientes/api/contratos.api';
import { montarRanking, calcularSupermeta, progressoPct, faltaParaMeta, metaBatida } from '@/features/metas/lib/metas.calc';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round = (v) => Math.round(num(v) * 100) / 100;

// Agrupa uma lista contando ocorrências por um campo (detectado), retornando { chave: total }.
function contarPor(lista, campos) {
  const out = {};
  for (const item of lista || []) {
    let chave = null;
    for (const c of campos) { if (item?.[c]) { chave = item[c]; break; } }
    chave = chave || 'sem_categoria';
    out[chave] = (out[chave] || 0) + 1;
  }
  return out;
}

/**
 * @param {object} d dados crus já carregados na página
 * @param {Array} d.clientes  @param {Array} d.leads  @param {Array} d.metrics
 * @param {Array} d.custos    @param {Array} d.vendas  @param {Array} d.metas
 * @param {Array} d.closers   @param {number} d.mrrBase @param {Array} d.tarefas
 * @param {Array} d.campanhas @param {string} d.competencia @param {Date} d.now
 */
export function montarResumo({
  clientes = [], leads = [], metrics = [], custos = [], vendas = [], metas = [],
  closers = [], mrrBase = 0, tarefas = [], campanhas = [], competencia, now = new Date(),
}) {
  const year = now.getFullYear();
  const cm = now.getMonth();

  // ---------- Financeiro ----------
  const contratos = flattenContratos(clientes);
  const receitaSeries = receitaSeriesYear(contratos, year, now);
  const mrrSeries = mrrSeriesYear(contratos, year, now);
  const adsAno = adsSeriesYear(metrics, year);
  const custoOpSeries = custoOperacionalSeriesYear(custos, year, now);
  const custosSeries = adsAno.spend.map((s, i) => s + custoOpSeries[i]);

  const receitaAno = sum(receitaSeries);
  const mrrAno = sum(mrrSeries);
  const gastoAdsAno = sum(adsAno.spend);
  const custoOpAno = sum(custoOpSeries);
  const custosAno = gastoAdsAno + custoOpAno;
  const convAno = sum(adsAno.conversions);

  const mrrAgora = mrrAtual(clientes);
  const tcvMes = tcvDoMes(clientes, year, cm);
  const receitaMes = mrrAgora + tcvMes;

  const gastoPlat = { meta: 0, google: 0 };
  for (const m of metrics) {
    const dt = parseDateLocal(m.date);
    if (!dt || dt.getFullYear() !== year) continue;
    const plat = m.campaigns?.platform;
    if (plat === 'meta') gastoPlat.meta += num(m.spend);
    else if (plat === 'google') gastoPlat.google += num(m.spend);
  }

  const topMrr = clientes
    .map((c) => ({ nome: c.nome, empresa: c.empresa || null, mrr: c.status === 'churn' ? 0 : mrrDoCliente(c.contratos) }))
    .filter((r) => r.mrr > 0)
    .sort((a, b) => b.mrr - a.mrr)
    .slice(0, 8)
    .map((r) => ({ ...r, mrr: round(r.mrr) }));

  const aVencer = contratosAVencer(contratos, 30, now).slice(0, 10).map((ct) => ({
    cliente: ct._cliente?.nome ?? 'Cliente',
    tipo: ct.tipo,
    valor: round(ct.valor),
    dias: Math.ceil((parseDateLocal(ct.data_fim) - now) / (1000 * 60 * 60 * 24)),
  }));

  const serieMensal = MES_LABELS.map((mes, i) => ({
    mes,
    receita: round(receitaSeries[i]),
    custos: round(custosSeries[i]),
    mrr: round(mrrSeries[i]),
  }));

  // ---------- Metas & Vendas ----------
  const metaGlobal = metas.find((m) => !m.usuario_id && m.competencia === competencia) || null;
  const metaValor = num(metaGlobal?.valor_meta);
  // Feito da meta = Receita do mês (MRR ativo + TCV ativo do mês) + vendas avulsas.
  const totalCloser = vendas.filter((v) => v.closer_id).reduce((s, v) => s + num(v.valor), 0);
  const totalAvulsas = vendas.filter((v) => !v.contrato_id).reduce((s, v) => s + num(v.valor), 0);
  const feito = receitaMes + totalAvulsas;
  const baseSupermeta = Math.max(0, feito - totalCloser);
  const { porCloser } = calcularSupermeta(vendas.filter((v) => v.closer_id), metaValor, baseSupermeta);
  const supermetaTotal = Array.from(porCloser.values()).reduce((s, v) => s + v, 0);
  const ranking = montarRanking({ closers, vendas, metas, competencia }).map((e) => ({
    nome: e.nome, total: round(e.total), vendas: e.count, meta: round(e.meta),
  }));

  // ---------- Comercial (Leads) ----------
  const leadsSeries = leadsSeriesYear(leads, year);
  const leadsAno = sum(leadsSeries);
  const valorPipeline = leads.reduce((s, l) => s + num(l.valor), 0);
  const convertidos = leads.filter((l) => l.cliente_id).length;

  // ---------- Clientes & Operação ----------
  const novosSeries = novosClientesSeriesYear(clientes, year);
  const ativos = clientes.filter((c) => c.status === 'ativo').length;
  const churn = clientes.filter((c) => c.status === 'churn').length;

  return {
    periodo: { ano: year, mes: MES_LABELS[cm], mes_index: cm + 1 },
    financeiro: {
      receita_ano: round(receitaAno),
      receita_mes: round(receitaMes),
      mrr_atual: round(mrrAgora),
      mrr_ano: round(mrrAno),
      tcv_mes: round(tcvMes),
      pontual_ano: round(Math.max(receitaAno - mrrAno, 0)),
      gasto_ads_ano: round(gastoAdsAno),
      gasto_ads_mes: round(adsAno.spend[cm]),
      custo_operacional_ano: round(custoOpAno),
      custo_operacional_mes: round(custoOpSeries[cm]),
      custos_totais_ano: round(custosAno),
      margem_ano: round(receitaAno - custosAno),
      margem_mes: round(receitaMes - custosSeries[cm]),
      roi_ano_pct: custosAno > 0 ? round(((receitaAno - custosAno) / custosAno) * 100) : 0,
      roas_ano: gastoAdsAno > 0 ? round((convAno * RECEITA_POR_CONVERSAO) / gastoAdsAno) : 0,
      conversoes_ano: Math.round(convAno),
      gasto_por_plataforma: { meta: round(gastoPlat.meta), google: round(gastoPlat.google) },
      clientes_com_contrato: clientesComContrato(clientes),
      serie_mensal: serieMensal,
      top_clientes_mrr: topMrr,
      contratos_a_vencer_30d: aVencer,
    },
    metas: {
      meta_do_mes: round(metaValor),
      feito: round(feito),
      mrr_base: round(num(mrrBase)),
      vendas_novas: round(totalNovas),
      progresso_pct: round(progressoPct(feito, metaValor)),
      falta: round(faltaParaMeta(feito, metaValor)),
      batida: metaBatida(feito, metaValor),
      supermeta_total: round(supermetaTotal),
      ranking_closers: ranking,
    },
    comercial: {
      leads_ano: leadsAno,
      leads_mes: leadsSeries[cm],
      leads_convertidos: convertidos,
      taxa_conversao_pct: leadsAno > 0 ? round((convertidos / leadsAno) * 100) : 0,
      valor_pipeline: round(valorPipeline),
      leads_por_origem: contarPor(leads, ['origem']),
      leads_por_etapa: contarPor(leads, ['etapa', 'status', 'estagio', 'fase', 'coluna']),
      serie_mensal: MES_LABELS.map((mes, i) => ({ mes, leads: leadsSeries[i] })),
    },
    campanhas: {
      total: campanhas.length,
      ativas: campanhas.filter((c) => c.status === 'active').length,
      pausadas: campanhas.filter((c) => c.status === 'paused').length,
      encerradas: campanhas.filter((c) => c.status === 'ended').length,
    },
    clientes: {
      ativos,
      churn,
      novos_no_ano: sum(novosSeries),
      serie_mensal: MES_LABELS.map((mes, i) => ({ mes, novos: novosSeries[i] })),
    },
    tarefas: {
      total: tarefas.length,
      por_status: contarPor(tarefas, ['status']),
    },
  };
}
