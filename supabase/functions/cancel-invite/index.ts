// supabase/functions/cancel-invite/index.ts
//
// Edge Function: cancela um convite pendente removendo o usuário recém-criado
// que ainda não logou. Admin only.
// Body JSON: { user_id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Server misconfigured.' }, 500);
  }

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

  const { data: callerProfile, error: profileErr } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (profileErr || !callerProfile || callerProfile.role !== 'admin') {
    return jsonResponse({ error: 'Forbidden: admin only.' }, 403);
  }

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const userId = (body.user_id ?? '').trim();
  if (!userId) {
    return jsonResponse({ error: 'user_id é obrigatório.' }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Confere que o usuário ainda não logou (segurança extra: só cancela convite pendente).
  const { data: userRow, error: getErr } =
    await adminClient.auth.admin.getUserById(userId);

  if (getErr || !userRow?.user) {
    return jsonResponse({ error: 'Usuário não encontrado.' }, 404);
  }

  if (userRow.user.last_sign_in_at) {
    return jsonResponse(
      { error: 'Este usuário já aceitou o convite; remova pelo painel de usuários.' },
      400,
    );
  }

  const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
  if (delErr) {
    return jsonResponse(
      { error: delErr.message ?? 'Falha ao cancelar convite.' },
      500,
    );
  }

  // ON DELETE CASCADE em profiles.id remove a linha do profile automaticamente.
  return jsonResponse({ ok: true });
});
