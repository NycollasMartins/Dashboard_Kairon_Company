// supabase/functions/google-calendar-sync/index.ts
//
// Sincronização entre o dashboard e o Google Calendar (calendário único da
// empresa). Usa o refresh_token salvo em public.google_calendar_credentials
// e renova o access_token quando necessário. Secrets/tokens só vivem aqui.
//
// POST body:
//   { action: 'push',   event: {...} }       -> cria/atualiza no Google
//   { action: 'delete', google_event_id }    -> remove no Google
//   { action: 'pull' }                        -> importa eventos do Google
//
// Apenas admin/head podem chamar (a leitura no dashboard é via RLS).
//
// Secrets: GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET
// Plataforma: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_API = 'https://www.googleapis.com/calendar/v3/calendars';

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

// Garante um access_token válido (renova via refresh_token se necessário).
async function ensureAccessToken(admin: ReturnType<typeof serviceClient>) {
  const CLIENT_ID = Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID');
  const CLIENT_SECRET = Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET');
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Integração Google Calendar não configurada (secrets ausentes).');
  }
  const { data: cred } = await admin
    .from('google_calendar_credentials')
    .select('*')
    .eq('id', true)
    .maybeSingle();
  if (!cred || !cred.refresh_token) {
    throw new Error('Google Calendar não conectado. Conecte uma conta no dashboard.');
  }
  const calId = cred.google_calendar_id || 'primary';
  const valid =
    cred.access_token &&
    cred.token_expires_at &&
    new Date(cred.token_expires_at).getTime() - Date.now() > 60_000;
  if (valid) return { accessToken: cred.access_token as string, calId };

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: cred.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    // invalid_grant = refresh_token expirado/revogado (comum em apps OAuth em
    // modo "Testing", que perdem o refresh_token a cada 7 dias).
    if (res.status === 400 || /invalid_grant/i.test(errBody)) {
      throw new Error('A conexão com o Google Calendar expirou ou foi revogada. Reconecte a conta clicando em "Conectar Google Calendar".');
    }
    throw new Error(`Falha ao renovar token do Google (${res.status}).`);
  }
  const t = await res.json();
  const expiresAt = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();
  await admin
    .from('google_calendar_credentials')
    .update({ access_token: t.access_token, token_expires_at: expiresAt })
    .eq('id', true);
  return { accessToken: t.access_token as string, calId };
}

// Evento do dashboard -> recurso do Google.
function toGoogleEvent(ev: Record<string, unknown>) {
  const base: Record<string, unknown> = {
    summary: ev.title ?? '(sem título)',
    description: ev.description ?? undefined,
    location: ev.location ?? undefined,
  };
  if (ev.all_day) {
    return {
      ...base,
      start: { date: String(ev.start_at).slice(0, 10) },
      end: { date: String(ev.end_at).slice(0, 10) },
    };
  }
  return {
    ...base,
    start: { dateTime: new Date(String(ev.start_at)).toISOString() },
    end: { dateTime: new Date(String(ev.end_at)).toISOString() },
  };
}

// Recurso do Google -> linha do dashboard.
function fromGoogleEvent(g: Record<string, any>) {
  const allDay = !!g.start?.date;
  const start = allDay ? `${g.start.date}T00:00:00Z` : g.start?.dateTime;
  const end = allDay ? `${g.end?.date ?? g.start.date}T00:00:00Z` : g.end?.dateTime ?? g.start?.dateTime;
  if (!start || !end) return null;
  return {
    title: g.summary ?? '(sem título)',
    description: g.description ?? null,
    location: g.location ?? null,
    all_day: allDay,
    start_at: start,
    end_at: end,
    type: 'meeting',
    google_event_id: g.id,
  };
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

  // Auth: exige admin/head.
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
  if (!profile || !['admin', 'head'].includes(profile.role)) {
    return jsonResponse({ error: 'Forbidden: admin/head only.' }, 403);
  }

  let body: { action?: string; event?: Record<string, unknown>; google_event_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const admin = serviceClient();

  try {
    const { accessToken, calId } = await ensureAccessToken(admin);
    const base = `${CAL_API}/${encodeURIComponent(calId)}/events`;
    const authHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    // ---------------- PUSH ----------------
    if (body.action === 'push') {
      const ev = body.event ?? {};
      const resource = toGoogleEvent(ev);
      const gid = ev.google_event_id ? String(ev.google_event_id) : '';
      const url = gid ? `${base}/${encodeURIComponent(gid)}` : base;
      const method = gid ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, headers: authHeaders, body: JSON.stringify(resource) });
      if (!r.ok) {
        const t = await r.text();
        return jsonResponse({ error: `Google rejeitou o evento (${r.status}): ${t}` }, 502);
      }
      const g = await r.json();
      const newGid = g.id as string;
      // Persiste o google_event_id na linha local (service role ignora RLS).
      if (ev.id && newGid && newGid !== ev.google_event_id) {
        await admin.from('calendar_events').update({ google_event_id: newGid }).eq('id', ev.id);
      }
      return jsonResponse({ google_event_id: newGid });
    }

    // ---------------- DELETE ----------------
    if (body.action === 'delete') {
      const gid = body.google_event_id;
      if (!gid) return jsonResponse({ error: 'google_event_id ausente.' }, 400);
      const r = await fetch(`${base}/${encodeURIComponent(gid)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      // 404/410 = já não existe no Google; tratamos como sucesso.
      if (!r.ok && r.status !== 404 && r.status !== 410) {
        const t = await r.text();
        return jsonResponse({ error: `Falha ao remover no Google (${r.status}): ${t}` }, 502);
      }
      return jsonResponse({ ok: true });
    }

    // ---------------- PULL ----------------
    if (body.action === 'pull') {
      const timeMin = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const timeMax = new Date(Date.now() + 180 * 86_400_000).toISOString();
      let pageToken: string | undefined;
      let imported = 0;
      do {
        const params = new URLSearchParams({
          singleEvents: 'true',
          orderBy: 'startTime',
          timeMin,
          timeMax,
          maxResults: '250',
        });
        if (pageToken) params.set('pageToken', pageToken);
        const r = await fetch(`${base}?${params.toString()}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!r.ok) {
          const t = await r.text();
          return jsonResponse({ error: `Falha ao listar eventos do Google (${r.status}): ${t}` }, 502);
        }
        const data = await r.json();
        for (const g of data.items ?? []) {
          if (g.status === 'cancelled') continue;
          const row = fromGoogleEvent(g);
          if (!row) continue;
          const { data: existing } = await admin
            .from('calendar_events')
            .select('id')
            .eq('google_event_id', g.id)
            .maybeSingle();
          if (existing) {
            // Não sobrescreve o type definido localmente.
            const { type: _omitType, ...rest } = row;
            await admin.from('calendar_events').update(rest).eq('id', existing.id);
          } else {
            await admin.from('calendar_events').insert(row);
          }
          imported++;
        }
        pageToken = data.nextPageToken;
      } while (pageToken);
      return jsonResponse({ imported });
    }

    return jsonResponse({ error: `Ação desconhecida: ${body.action ?? ''}` }, 400);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message ?? 'Erro na sincronização.' }, 502);
  }
});
