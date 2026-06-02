import { supabase } from '@/infrastructure/supabase/client';

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
