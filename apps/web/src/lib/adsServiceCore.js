import { supabase } from '@/infrastructure/supabase/client';

// ====================================================================
// Núcleo compartilhado dos serviços de anúncios (Meta Ads / Google Ads).
//
// SEGURANÇA: nenhum token/segredo das plataformas vive aqui no frontend.
// Quando o modo real está ativo, este serviço apenas chama uma Supabase
// Edge Function (`meta-ads` / `google-ads`) que guarda os segredos e fala
// com as APIs externas. Por padrão roda em modo MOCK, retornando dados
// realistas para a UI funcionar 100% localmente sem credenciais.
//
// Trocar mock -> real: defina VITE_ADS_USE_MOCK=false no .env.local e
// publique as Edge Functions com os secrets configurados (ver README).
// ====================================================================

const USE_MOCK = import.meta.env.VITE_ADS_USE_MOCK !== 'false';

async function unwrapInvoke({ data, error }) {
  if (error) {
    let message = error.message || 'Erro ao chamar a Edge Function de anúncios.';
    try {
      const response = error.context?.response;
      if (response && typeof response.json === 'function') {
        const body = await response.json();
        if (body?.error) message = body.error;
      }
    } catch {
      // corpo não era JSON — mantém a mensagem original
    }
    throw new Error(message);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

// ---- Gerador de métricas mockadas (determinístico por seed) ----------
function seededFactor(seed, index) {
  const x = Math.sin(seed * 9301 + index * 49297) * 233280;
  return Math.abs(x - Math.floor(x)); // 0..1
}

function buildMockMetrics(seed, days = 14) {
  const rows = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const f = seededFactor(seed, i);
    const impressions = Math.round(2000 + f * 12000);
    const clicks = Math.round(impressions * (0.012 + f * 0.04));
    const spend = Math.round((clicks * (0.8 + f * 2.2)) * 100) / 100;
    const conversions = Math.round(clicks * (0.04 + f * 0.12));
    const reach = Math.round(impressions * (0.6 + f * 0.3));
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
    const cpc = clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0;
    const cpa = conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : 0;
    const roas = spend > 0 ? Math.round(((conversions * 80) / spend) * 100) / 100 : 0;
    rows.push({
      date: d.toISOString().slice(0, 10),
      spend,
      impressions,
      clicks,
      ctr,
      cpc,
      conversions,
      cpa,
      roas,
      reach,
    });
  }
  return rows;
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

/**
 * Cria um serviço de anúncios com interface comum para Meta e Google.
 * @param {{ platform: 'meta' | 'google', edgeFunction: string, label: string }} cfg
 */
export function createAdsService({ platform, edgeFunction, label }) {
  const invoke = (action, payload = {}) =>
    supabase.functions
      .invoke(edgeFunction, { body: { action, platform, ...payload } })
      .then(unwrapInvoke);

  return {
    platform,
    label,
    isMock: USE_MOCK,

    /** Lista campanhas existentes na conta de anúncios da plataforma. */
    async listCampaigns() {
      if (USE_MOCK) {
        return [
          { external_id: `${platform}-mock-1`, name: `Campanha ${label} (exemplo)`, status: 'active' },
        ];
      }
      return invoke('listCampaigns');
    },

    /** Histórico de métricas diárias de uma campanha na plataforma. */
    async getMetrics(externalId, { days = 14 } = {}) {
      if (USE_MOCK) {
        return buildMockMetrics(hashString(externalId || platform), days);
      }
      return invoke('getMetrics', { external_id: externalId, days });
    },

    /** Cria a campanha na plataforma e devolve { external_id, account_id }. */
    async createCampaign(payload) {
      if (USE_MOCK) {
        return {
          external_id: `${platform}-mock-${hashString(payload?.name || 'novo')}`,
          account_id: `${platform}-act-mock`,
        };
      }
      return invoke('createCampaign', { campaign: payload });
    },

    async pauseCampaign(externalId) {
      if (USE_MOCK) return { ok: true, status: 'paused' };
      return invoke('pauseCampaign', { external_id: externalId });
    },

    async resumeCampaign(externalId) {
      if (USE_MOCK) return { ok: true, status: 'active' };
      return invoke('resumeCampaign', { external_id: externalId });
    },

    async endCampaign(externalId) {
      if (USE_MOCK) return { ok: true, status: 'ended' };
      return invoke('endCampaign', { external_id: externalId });
    },
  };
}
