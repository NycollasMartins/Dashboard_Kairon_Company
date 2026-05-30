// supabase/functions/google-calendar-oauth/index.ts
//
// Fluxo OAuth 2.0 do Google Calendar (calendário ÚNICO da empresa).
// O frontend NUNCA vê client secret nem tokens — tudo fica nesta função.
//
// Rotas:
//   POST { action: 'authUrl' }     -> (admin) devolve a URL de consentimento
//   POST { action: 'disconnect' }  -> (admin) apaga os tokens salvos
//   GET  ?code=...&state=...        -> callback do Google: troca o code por
//                                      refresh_token e salva em
//                                      public.google_calendar_credentials
//
// IMPORTANTE: faça o deploy SEM verificação automática de JWT, pois o
// callback (GET) é chamado pelo Google e não traz Authorization:
//   supabase functions deploy google-calendar-oauth --no-verify-jwt
// (ou use o config.toml com verify_jwt = false).
//
// Secrets esperados (supabase secrets set ...):
//   GOOGLE_CALENDAR_CLIENT_ID
//   GOOGLE_CALENDAR_CLIENT_SECRET
//   GOOGLE_CALENDAR_REDIRECT_URI   -> opcional; default:
//                                     ${SUPABASE_URL}/functions/v1/google-calendar-oauth
// Preenchidos pela plataforma: SUPABASE_URL, SUPABASE_ANON_KEY,
//                              SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutos

function html(body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"/>
     <meta name="viewport" content="width=device-width,initial-scale=1"/>
     <title>Google Calendar</title>
     <style>body{font-family:system-ui,sans-serif;background:#0d0d0d;color:#fff;
     display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
     .card{background:#16161f;border:1px solid #2a2a36;border-radius:16px;padding:32px 40px;
     max-width:420px;text-align:center}h1{font-size:18px;margin:0 0 8px}p{color:#9a9aa6;font-size:14px;line-height:1.5}
     .ok{color:#34d399}.err{color:#f87171}</style></head>
     <body><div class="card">${body}</div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

function redirectUri(): string {
  const override = Deno.env.get('GOOGLE_CALENDAR_REDIRECT_URI');
  if (override) return override;
  const base = Deno.env.get('SUPABASE_URL') ?? '';
  return `${base}/functions/v1/google-calendar-oauth`;
}

function randomState(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const CLIENT_ID = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID');
  const CLIENT_SECRET = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET');

  // ------------------------------------------------------------------
  // GET = callback do Google (sem JWT).
  // ------------------------------------------------------------------
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const error = url.searchParams.get('error');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (error) return html(`<h1 class="err">Autorização cancelada</h1><p>${error}</p>`, 400);
    if (!code || !state) return html('<h1 class="err">Requisição inválida</h1><p>Faltam parâmetros.</p>', 400);
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return html('<h1 class="err">Integração não configurada</h1><p>Defina os secrets do Google Calendar.</p>', 500);
    }

    const admin = serviceClient();
    const { data: cred } = await admin
      .from('google_calendar_credentials')
      .select('oauth_state, oauth_state_at')
      .eq('id', true)
      .maybeSingle();

    if (!cred || cred.oauth_state !== state) {
      return html('<h1 class="err">Estado inválido</h1><p>Reinicie a conexão pelo dashboard.</p>', 400);
    }
    if (cred.oauth_state_at && Date.now() - new Date(cred.oauth_state_at).getTime() > STATE_TTL_MS) {
      return html('<h1 class="err">Link expirado</h1><p>Reinicie a conexão pelo dashboard.</p>', 400);
    }

    // Troca o code por tokens.
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      return html(`<h1 class="err">Falha ao obter tokens</h1><p>${tokenRes.status}: ${t}</p>`, 502);
    }
    const tokens = await tokenRes.json();
    if (!tokens.refresh_token) {
      return html(
        '<h1 class="err">Sem refresh token</h1><p>Revogue o acesso em myaccount.google.com/permissions e tente de novo (é preciso prompt=consent).</p>',
        400,
      );
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
    await admin
      .from('google_calendar_credentials')
      .update({
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token ?? null,
        token_expires_at: expiresAt,
        oauth_state: null,
        oauth_state_at: null,
        connected_at: new Date().toISOString(),
      })
      .eq('id', true);

    return html('<h1 class="ok">Google Calendar conectado!</h1><p>Pode fechar esta aba e voltar ao dashboard.</p>');
  }

  // ------------------------------------------------------------------
  // POST = ações do dashboard (exige JWT de admin).
  // ------------------------------------------------------------------
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: 'Server misconfigured.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing auth token.' }, 401);
  }
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !caller) {
    return jsonResponse({ error: 'Invalid session.' }, 401);
  }
  const { data: profile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();
  if (!profile || profile.role !== 'admin') {
    return jsonResponse({ error: 'Forbidden: admin only.' }, 403);
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const admin = serviceClient();

  if (body.action === 'disconnect') {
    const { error } = await admin
      .from('google_calendar_credentials')
      .update({
        refresh_token: null,
        access_token: null,
        token_expires_at: null,
        connected_at: null,
        connected_by: null,
        oauth_state: null,
        oauth_state_at: null,
      })
      .eq('id', true);
    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true });
  }

  if (body.action === 'authUrl') {
    if (!CLIENT_ID || !CLIENT_SECRET) {
      return jsonResponse(
        { error: 'Integração Google Calendar não configurada. Defina GOOGLE_CALENDAR_CLIENT_ID e GOOGLE_CALENDAR_CLIENT_SECRET.' },
        501,
      );
    }
    const state = randomState();
    // Cria/atualiza a linha singleton com o state e o admin que iniciou.
    const { error: upErr } = await admin
      .from('google_calendar_credentials')
      .upsert(
        { id: true, oauth_state: state, oauth_state_at: new Date().toISOString(), connected_by: caller.id },
        { onConflict: 'id' },
      );
    if (upErr) return jsonResponse({ error: upErr.message }, 500);

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: redirectUri(),
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
    });
    return jsonResponse({ url: `${AUTH_URL}?${params.toString()}` });
  }

  return jsonResponse({ error: `Ação desconhecida: ${body.action ?? ''}` }, 400);
});
