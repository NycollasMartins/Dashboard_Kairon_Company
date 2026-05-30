// supabase/functions/meta-ads/index.ts
//
// Edge Function: intermediário seguro para a Meta Marketing API.
// O frontend NUNCA fala direto com a Meta — chama esta função, que guarda
// os segredos e repassa as chamadas autenticadas.
//
// Body JSON: { action, platform, ...payload }
//   action ∈ listCampaigns | getMetrics | createCampaign
//            | pauseCampaign | resumeCampaign | endCampaign
//
// Secrets esperados (configurar com `supabase secrets set`):
//   META_ACCESS_TOKEN     -> token de longa duração (System User Token)
//   META_AD_ACCOUNT_ID     -> ex: act_1234567890
//   META_API_VERSION       -> opcional, default v21.0
//
// Preenchidos automaticamente pela plataforma:
//   SUPABASE_URL, SUPABASE_ANON_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const GRAPH_BASE = 'https://graph.facebook.com';

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
  let body: { action?: string; external_id?: string; days?: number; campaign?: unknown };
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

  // ------------------------------------------------------------------
  // 4) Dispatch por ação.
  //
  // As chamadas reais à Graph API ficam abaixo como TODO. A estrutura de
  // auth/secrets já está pronta — basta implementar cada fetch e remover
  // os 501. Exemplo de chamada:
  //   const url = `${GRAPH_BASE}/${API_VERSION}/${AD_ACCOUNT_ID}/campaigns`
  //     + `?fields=id,name,status&access_token=${ACCESS_TOKEN}`;
  //   const res = await fetch(url);
  //   const json = await res.json();
  // ------------------------------------------------------------------
  try {
    switch (action) {
      case 'listCampaigns':
        // TODO: GET /{ad_account_id}/campaigns
        return jsonResponse({ error: 'listCampaigns ainda não implementado.' }, 501);
      case 'getMetrics':
        // TODO: GET /{campaign_id}/insights?fields=spend,impressions,clicks,ctr,cpc,...
        return jsonResponse({ error: 'getMetrics ainda não implementado.' }, 501);
      case 'createCampaign':
        // TODO: POST /{ad_account_id}/campaigns
        return jsonResponse({ error: 'createCampaign ainda não implementado.' }, 501);
      case 'pauseCampaign':
        // TODO: POST /{campaign_id} { status: 'PAUSED' }
        return jsonResponse({ error: 'pauseCampaign ainda não implementado.' }, 501);
      case 'resumeCampaign':
        // TODO: POST /{campaign_id} { status: 'ACTIVE' }
        return jsonResponse({ error: 'resumeCampaign ainda não implementado.' }, 501);
      case 'endCampaign':
        // TODO: POST /{campaign_id} { status: 'DELETED' | 'ARCHIVED' }
        return jsonResponse({ error: 'endCampaign ainda não implementado.' }, 501);
      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    return jsonResponse({ error: (e as Error).message ?? 'Erro na Meta Ads API.' }, 502);
  }
});
