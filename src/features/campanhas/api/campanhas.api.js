import { supabase } from '@/infrastructure/supabase/client';

const TABLE = 'campaigns';
const METRICS_TABLE = 'campaign_metrics';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export const campanhasApi = {
  list: () =>
    supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .then(unwrap),

  get: (id) =>
    supabase.from(TABLE).select('*').eq('id', id).single().then(unwrap),

  create: (data) =>
    supabase.from(TABLE).insert(data).select('*').single().then(unwrap),

  update: (id, data) =>
    supabase.from(TABLE).update(data).eq('id', id).select('*').single().then(unwrap),

  updateStatus: (id, status) =>
    supabase.from(TABLE).update({ status }).eq('id', id).select('*').single().then(unwrap),

  remove: async (id) => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },

  // Histórico de métricas diárias de uma campanha (ordem cronológica).
  listMetrics: (campaignId) =>
    supabase
      .from(METRICS_TABLE)
      .select('*')
      .eq('campaign_id', campaignId)
      .order('date', { ascending: true })
      .then(unwrap),

  // Upsert idempotente por (campaign_id, date) — usado ao sincronizar
  // métricas vindas das plataformas (Meta/Google).
  upsertMetrics: (campaignId, rows) =>
    supabase
      .from(METRICS_TABLE)
      .upsert(
        rows.map((r) => ({ ...r, campaign_id: campaignId })),
        { onConflict: 'campaign_id,date' },
      )
      .select('*')
      .then(unwrap),
};
