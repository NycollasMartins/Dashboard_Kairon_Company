// supabase/functions/google-ads/index.ts
//
// Edge Function: intermediário seguro para a Google Ads API.
// O frontend NUNCA fala direto com o Google — chama esta função, que guarda
// os segredos e repassa as chamadas autenticadas (OAuth2 + developer token).
//
// Body JSON: { action, platform, ...payload }
//   action ∈ listCampaigns | getMetrics | createCampaign
//            | pauseCampaign | resumeCampaign | endCampaign
//
// Secrets esperados (configurar com `supabase secrets set`):
//   GOOGLE_ADS_DEVELOPER_TOKEN   -> developer token aprovado
//   GOOGLE_ADS_CLIENT_ID         -> OAuth2 client id
//   GOOGLE_ADS_CLIENT_SECRET     -> OAuth2 client secret
//   GOOGLE_ADS_REFRESH_TOKEN     -> refresh token de longa duração
//   GOOGLE_ADS_CUSTOMER_ID       -> id da conta (somente dígitos, sem traços)
//   GOOGLE_ADS_LOGIN_CUSTOMER_ID -> opcional (MCC/manager)
//
// Preenchidos automaticamente pela plataforma:
//   SUPABASE_URL, SUPABASE_ANON_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ADS_API_BASE = 'https://googleads.googleapis.com';

// Troca o refresh token por um access token de curta duração.
async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth falhou: ${res.status}`);
  }
  const json = await res.json();
  return json.access_token as string;
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
  let body: { action?: string; external_id?: string; days?: number; campaign?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }
  const action = body.action ?? '';

  // 3) Segredos do Google Ads.
  const DEVELOPER_TOKEN = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN');
  const CLIENT_ID = Deno.env.get('GOOGLE_ADS_CLIENT_ID');
  const CLIENT_SECRET = Deno.env.get('GOOGLE_ADS_CLIENT_SECRET');
  const REFRESH_TOKEN = Deno.env.get('GOOGLE_ADS_REFRESH_TOKEN');
  const CUSTOMER_ID = Deno.env.get('GOOGLE_ADS_CUSTOMER_ID');
  if (!DEVELOPER_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !CUSTOMER_ID) {
    return jsonResponse(
      {
        error:
          'Integração Google Ads não configurada. Defina os secrets GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN e GOOGLE_ADS_CUSTOMER_ID.',
      },
      501,
    );
  }

  // ------------------------------------------------------------------
  // 4) Dispatch por ação.
  //
  // Fluxo real (TODO): obter access token via getAccessToken(...) e chamar
  // a Google Ads API REST/GAQL com os headers:
  //   Authorization: Bearer <access_token>
  //   developer-token: <DEVELOPER_TOKEN>
  //   login-customer-id: <GOOGLE_ADS_LOGIN_CUSTOMER_ID> (se MCC)
  // Endpoint base: `${ADS_API_BASE}/v17/customers/${CUSTOMER_ID}/...`
  // ------------------------------------------------------------------
  try {
    switch (action) {
      case 'listCampaigns':
        // TODO: POST .../googleAds:searchStream com GAQL de campaigns
        return jsonResponse({ error: 'listCampaigns ainda não implementado.' }, 501);
      case 'getMetrics':
        // TODO: GAQL em metrics.* (cost_micros, impressions, clicks, ...)
        return jsonResponse({ error: 'getMetrics ainda não implementado.' }, 501);
      case 'createCampaign':
        // TODO: campaignBudgets:mutate + campaigns:mutate
        return jsonResponse({ error: 'createCampaign ainda não implementado.' }, 501);
      case 'pauseCampaign':
        // TODO: campaigns:mutate { status: PAUSED }
        return jsonResponse({ error: 'pauseCampaign ainda não implementado.' }, 501);
      case 'resumeCampaign':
        // TODO: campaigns:mutate { status: ENABLED }
        return jsonResponse({ error: 'resumeCampaign ainda não implementado.' }, 501);
      case 'endCampaign':
        // TODO: campaigns:mutate { status: REMOVED }
        return jsonResponse({ error: 'endCampaign ainda não implementado.' }, 501);
      default:
        return jsonResponse({ error: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    return jsonResponse({ error: (e as Error).message ?? 'Erro na Google Ads API.' }, 502);
  }
});
