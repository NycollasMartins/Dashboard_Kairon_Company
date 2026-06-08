// supabase/functions/push-fanout/index.ts
//
// Edge Function: envia push (Expo) para todos os dispositivos do usuário
// dono de uma notificação recém-criada.
//
// Chamada pelo gatilho `notifications_push_fanout` (pg_net) com body:
//   { "notification_id": "<uuid>" }
//
// Lê o conteúdo autoritativo da notificação pelo id (service_role) — não
// confia no corpo da requisição —, busca os push_tokens do usuário, manda
// para a Expo Push API e remove tokens inválidos (DeviceNotRegistered).
//
// Variáveis de ambiente (preenchidas automaticamente pela plataforma):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Server misconfigured.' }, 500);
  }

  let body: { notification_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const notificationId = body.notification_id;
  if (!notificationId) {
    return jsonResponse({ error: 'notification_id é obrigatório.' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Conteúdo autoritativo da notificação.
  const { data: notif, error: notifErr } = await admin
    .from('notifications')
    .select('id, user_id, type, title, body, link, metadata')
    .eq('id', notificationId)
    .maybeSingle();
  if (notifErr) return jsonResponse({ error: notifErr.message }, 500);
  if (!notif) return jsonResponse({ ok: true, skipped: 'notification not found' });

  // 2) Tokens do usuário.
  const { data: tokens, error: tokErr } = await admin
    .from('push_tokens')
    .select('token')
    .eq('user_id', notif.user_id);
  if (tokErr) return jsonResponse({ error: tokErr.message }, 500);
  if (!tokens || tokens.length === 0) return jsonResponse({ ok: true, sent: 0 });

  // Badge do ícone = leads não lidos do usuário (atualiza mesmo com app fechado).
  const { count: leadUnread } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', notif.user_id)
    .eq('type', 'lead')
    .is('read_at', null);

  // 3) Monta e envia as mensagens para a Expo Push API.
  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title: notif.title,
    body: notif.body ?? '',
    badge: leadUnread ?? 0,
    data: { link: notif.link, type: notif.type, ...(notif.metadata ?? {}) },
    channelId: 'default',
  }));

  let expoJson: { data?: Array<{ status?: string; details?: { error?: string } }> } | null = null;
  try {
    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    expoJson = await expoRes.json().catch(() => null);
  } catch (e) {
    return jsonResponse({ error: 'Falha ao chamar Expo Push API: ' + String(e) }, 502);
  }

  // 4) Remove tokens inválidos (DeviceNotRegistered) reportados pela Expo.
  const tickets = expoJson?.data;
  if (Array.isArray(tickets)) {
    const dead: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
        dead.push(tokens[i].token);
      }
    });
    if (dead.length) {
      await admin.from('push_tokens').delete().in('token', dead);
    }
  }

  return jsonResponse({ ok: true, sent: messages.length });
});
