import { supabase } from '../supabase/client.js';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export const financeiroApi = {
  // Métricas diárias de todas as campanhas (com a plataforma, para o breakdown).
  listCampaignMetrics: () =>
    supabase
      .from('campaign_metrics')
      .select('date, spend, conversions, clicks, impressions, campaigns(platform)')
      .order('date', { ascending: true })
      .then(unwrap),
};

const CUSTOS = 'operational_costs';

export const custosApi = {
  list: () =>
    supabase.from(CUSTOS).select('*').order('competencia', { ascending: false }).then(unwrap),

  create: (data) =>
    supabase.from(CUSTOS).insert(data).select('*').single().then(unwrap),

  update: (id, data) =>
    supabase.from(CUSTOS).update(data).eq('id', id).select('*').single().then(unwrap),

  remove: async (id) => {
    const { error } = await supabase.from(CUSTOS).delete().eq('id', id);
    if (error) throw error;
  },
};

// ------------------------------------------------------------------
// Recebíveis (contrato_parcelas) — cronograma de cobrança por contrato.
// ------------------------------------------------------------------
const PARCELAS = 'contrato_parcelas';

export const parcelasApi = {
  // Todas as parcelas com nome do cliente e tipo do contrato (para a tela).
  list: () =>
    supabase
      .from(PARCELAS)
      .select('*, cliente:cliente_id(id, nome, empresa, status), contrato:contrato_id(tipo, valor)')
      .order('vencimento', { ascending: true })
      .then(unwrap),

  // Registra pagamento manual (data default = hoje no chamador).
  marcarPago: (id, { pago_em, metodo_pagamento = null } = {}) =>
    supabase
      .from(PARCELAS)
      .update({
        pago_em: pago_em || new Date().toISOString().slice(0, 10),
        status: 'pago',
        origem_pagamento: 'manual',
        metodo_pagamento,
      })
      .eq('id', id)
      .select('*')
      .single()
      .then(unwrap),

  // Desfaz o pagamento (volta a em aberto).
  marcarAberto: (id) =>
    supabase
      .from(PARCELAS)
      .update({ pago_em: null, status: 'em_aberto', origem_pagamento: null, metodo_pagamento: null })
      .eq('id', id)
      .select('*')
      .single()
      .then(unwrap),
};

// ------------------------------------------------------------------
// Configuração financeira (linha única: saldo inicial de caixa).
// ------------------------------------------------------------------
export const financeConfigApi = {
  get: () =>
    supabase.from('finance_config').select('*').eq('id', 1).maybeSingle().then(unwrap),

  update: ({ saldo_inicial, saldo_inicial_data }) =>
    supabase
      .from('finance_config')
      .update({ saldo_inicial, saldo_inicial_data })
      .eq('id', 1)
      .select('*')
      .single()
      .then(unwrap),
};

// Vendas (para a Receita do mês unificada = bater com a aba Metas).
export const vendasFinApi = {
  list: () =>
    supabase.from('vendas').select('id, valor, tipo, contrato_id, data_venda').then(unwrap),
};
