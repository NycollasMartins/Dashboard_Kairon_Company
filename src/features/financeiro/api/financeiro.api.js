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
