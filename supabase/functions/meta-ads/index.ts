// supabase/functions/meta-ads/index.ts
//
// Edge Function: intermediário seguro para a Meta Marketing API.
// O frontend NUNCA fala direto com a Meta — chama esta função, que guarda
// os segredos e repassa as chamadas autenticadas.
//
// Body JSON: { action, platform, ...payload }
//   action ∈ listCampaigns | getMetrics | pauseCampaign | resumeCampaign | endCampaign
//   (createCampaign fica fora do escopo: gerenciamos status/leitura, não criação)
//
// Secrets esperados (configurar com `supabase secrets set`):
//   META_ACCESS_TOKEN  -> token de longa duração (System User Token)
//   META_AD_ACCOUNT_ID -> ex: act_1234567890
//   META_API_VERSION   -> opcional, default v21.0
//
// Preenchidos automaticamente pela plataforma:
//   SUPABASE_URL, SUPABASE_ANON_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const GRAPH_BASE = 'https://graph.facebook.com';

// ---- Mapeamentos Meta <-> dashboard ---------------------------------
function mapStatusFromMeta(metaStatus: string): string {
  switch ((metaStatus ?? '').toUpperCase()) {
    case 'ACTIVE':
      return 'active';
    case 'PAUSED':
      return 'paused';
    case 'ARCHIVED':
    case 'DELETED':
      return 'ended';
    default:
      return 'paused';
  }
}

function mapObjectiveFromMeta(obj: string): string | null {
  const o = (obj ?? '').toUpperCase();
  if (o.includes('AWARENESS') || o.includes('REACH')) return 'awareness';
  if (o.includes('TRAFFIC') || o.includes('LINK_CLICKS')) return 'traffic';
  if (o.includes('ENGAGEMENT') || o.includes('LIKES') || o.includes('EVENT')) return 'engagement';
  if (o.includes('LEAD')) return 'leads';
  if (o.includes('SALES') || o.includes('CONVERSION') || o.includes('CATALOG')) return 'sales';
  if (o.includes('APP')) return 'app_promotion';
  return null;
}

// Meta entrega orçamento em centavos (string). Converte para número em reais.
function centsToValue(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) / 100 : null;
}

// Soma valores de `actions`/`action_values` cujos tipos batem com conversões.
function sumConversionActions(arr: Array<{ action_type: string; value: string }> | undefined): number {
  if (!Array.isArray(arr)) return 0;
  let total = 0;
  for (const a of arr) {
    const t = (a.action_type ?? '').toLowerCase();
    if (t.includes('purchase') || t.includes('lead') || t.includes('complete_registration')) {
      const n = Number(a.value);
      if (Number.isFinite(n)) total += n;
    }
  }
  return Math.round(total * 100) / 100;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: 'Server misconfigured.' }, 500);
  }

  // 1) Valida o caller pelo JWT e exige role admin/head.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing auth token.' }, 401);
  }
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: caller },
    error: callerErr,
  } = await callerClient.auth.getUser();
  if (callerErr || !caller) {
    return jsonResponse({ error: 'Invalid session.' }, 401);
  }
  const { data: profile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();
  if (!profile || !['admin', 'head'].includes(profile.role)) {
    return jsonResponse({ error: 'Forbidden: admin/head only.' }, 403);
  }

  // 2) Body.
  let body: { action?: string; external_id?: string; days?: number };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }
  const action = body.action ?? '';

  // 3) Segredos da Meta.
  const ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN');
  const AD_ACCOUNT_ID = Deno.env.get('META_AD_ACCOUNT_ID');
  const API_VERSION = Deno.env.get('META_API_VERSION') ?? 'v21.0';
  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
    return jsonResponse(
      {
        error:
          'Integração Meta Ads não configurada. Defina os secrets META_ACCESS_TOKEN e META_AD_ACCOUNT_ID.',
      },
      501,
    );
  }
  const base = `${GRAPH_BASE}/${API_VERSION}`;

  // Lê erros da Graph API de forma legível.
  async function graphError(res: Response): Promise<string> {
    try {
      const j = await res.json();
      return j?.error?.message ?? `Meta API ${res.status}`;
    } catch {
      return `Meta API ${res.status}`;
    }
  }

  try {
    // ---------------- listCampaigns ----------------
    if (action === 'listCampaigns') {
      const out: Array<Record<string, unknown>> = [];
      const fields =
        'id,name,status,effective_status,objective,daily_budget,lifetime_budget';
      let url =
        `${base}/${AD_ACCOUNT_ID}/campaigns?fields=${fields}&limit=200` +
        `&access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
      // segue paginação
      for (let guard = 0; guard < 20 && url; guard += 1) {
        const res = await fetch(url);
        if (!res.ok) return jsonResponse({ error: await graphError(res) }, 502);
        const json = await res.json();
        for (const c of json.data ?? []) {
          const daily = centsToValue(c.daily_budget);
          const lifetime = centsToValue(c.lifetime_budget);
          out.push({
            external_id: c.id,
            name: c.name ?? 'Campanha sem nome',
            status: mapStatusFromMeta(c.effective_status ?? c.status),
            objective: mapObjectiveFromMeta(c.objective),
            budget: daily ?? lifetime ?? null,
            budget_type: daily != null ? 'daily' : lifetime != null ? 'lifetime' : 'daily',
            account_id: AD_ACCOUNT_ID,
          });
        }
        url = json.paging?.next ?? '';
      }
      return jsonResponse(out);
    }

    // ---------------- getMetrics ----------------
    if (action === 'getMetrics') {
      const externalId = body.external_id;
      if (!externalId) return jsonResponse({ error: 'external_id ausente.' }, 400);
      const days = Math.min(Math.max(Number(body.days) || 14, 1), 90);

      const until = new Date();
      const since = new Date();
      since.setDate(until.getDate() - (days - 1));
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const timeRange = encodeURIComponent(JSON.stringify({ since: fmt(since), until: fmt(until) }));
      const fields = 'spend,impressions,clicks,ctr,cpc,reach,actions,action_values';

      const rows: Array<Record<string, unknown>> = [];
      let url =
        `${base}/${externalId}/insights?fields=${fields}` +
        `&time_increment=1&time_range=${timeRange}&limit=500` +
        `&access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
      for (let guard = 0; guard < 20 && url; guard += 1) {
        const res = await fetch(url);
        if (!res.ok) return jsonResponse({ error: await graphError(res) }, 502);
        const json = await res.json();
        for (const r of json.data ?? []) {
          const spend = num(r.spend);
          const impressions = num(r.impressions);
          const clicks = num(r.clicks);
          const reach = num(r.reach);
          const ctr = r.ctr != null ? num(r.ctr) : impressions > 0 ? (clicks / impressions) * 100 : 0;
          const cpc = r.cpc != null ? num(r.cpc) : clicks > 0 ? spend / clicks : 0;
          const conversions = sumConversionActions(r.actions);
          const revenue = sumConversionActions(r.action_values);
          const cpa = conversions > 0 ? spend / conversions : 0;
          const roas = spend > 0 ? revenue / spend : 0;
          rows.push({
            date: r.date_start,
            spend: Math.round(spend * 100) / 100,
            impressions: Math.round(impressions),
            clicks: Math.round(clicks),
            ctr: Math.round(ctr * 1000) / 1000,
            cpc: Math.round(cpc * 100) / 100,
            conversions: Math.round(conversions),
            cpa: Math.round(cpa * 100) / 100,
            roas: Math.round(roas * 100) / 100,
            reach: Math.round(reach),
          });
        }
        url = json.paging?.next ?? '';
      }
      return jsonResponse(rows);
    }

    // ---------------- status (pause / resume / end) ----------------
    if (action === 'pauseCampaign' || action === 'resumeCampaign' || action === 'endCampaign') {
      const externalId = body.external_id;
      if (!externalId) return jsonResponse({ error: 'external_id ausente.' }, 400);
      const metaStatus =
        action === 'pauseCampaign' ? 'PAUSED' : action === 'resumeCampaign' ? 'ACTIVE' : 'ARCHIVED';
      const res = await fetch(`${base}/${externalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ status: metaStatus, access_token: ACCESS_TOKEN }),
      });
      if (!res.ok) return jsonResponse({ error: await graphError(res) }, 502);
      return jsonResponse({ ok: true, status: mapStatusFromMeta(metaStatus) });
    }

    if (action === 'createCampaign') {
      return jsonResponse(
        { error: 'Criação de campanha pela API não está habilitada (crie no Gerenciador de Anúncios e importe).' },
        501,
      );
    }

    return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message ?? 'Erro na Meta Ads API.' }, 502);
  }
});
