// supabase/functions/invite-user/index.ts
//
// Edge Function: convida um novo usuário pelo email (admin only).
// Body JSON:
//   { email, full_name, role }   -> cria o convite e envia email
//   { email, resend: true }      -> reenvia o convite existente
//
// Variáveis de ambiente esperadas:
//   SUPABASE_URL                  (preenchido automaticamente pela plataforma)
//   SUPABASE_ANON_KEY             (preenchido automaticamente pela plataforma)
//   SUPABASE_SERVICE_ROLE_KEY     (preenchido automaticamente pela plataforma)
//   SITE_URL                      (opcional; fallback caso o caller não envie `origin`)
//
// O redirecionamento do email é montado a partir de `body.origin` (mandado pelo
// front com window.location.origin). Cadastre todas as origens válidas em
// Authentication → URL Configuration → Redirect URLs do projeto.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const ALLOWED_ROLES = [
  'admin',
  'social media',
  'editor',
  'designer',
  'cs',
  'closer',
  'sdr',
  'bdr',
  'head',
  'dev',
  'tv',
  'Filmmaker',
];

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
  const FALLBACK_SITE_URL = Deno.env.get('SITE_URL') ?? '';

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Server misconfigured.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing auth token.' }, 401);
  }

  // 1) Valida o caller usando o JWT recebido.
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

  // 2) Parse do body.
  let body: {
    email?: string;
    full_name?: string;
    role?: string;
    resend?: boolean;
    origin?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Email inválido.' }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rawOrigin = (body.origin ?? '').trim() || FALLBACK_SITE_URL;
  let redirectTo: string | undefined;
  if (rawOrigin) {
    try {
      // valida que é uma URL http(s) bem formada
      const u = new URL(rawOrigin);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        redirectTo = `${u.origin}/aceitar-convite`;
      }
    } catch {
      // origin inválido — segue sem redirect, Supabase usa o Site URL padrão
    }
  }
  // O Supabase ainda valida `redirectTo` contra a allowlist em
  // Auth → URL Configuration → Redirect URLs antes de enviar o email.

  // ---- Modo RESEND ----
  if (body.resend) {
    const { error: resendErr } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      { redirectTo },
    );
    if (resendErr) {
      return jsonResponse(
        { error: resendErr.message ?? 'Falha ao reenviar convite.' },
        500,
      );
    }
    return jsonResponse({ ok: true, resent: true });
  }

  // ---- Modo CREATE ----
  const fullName = (body.full_name ?? '').trim();
  const role = body.role ?? '';

  if (!fullName) {
    return jsonResponse({ error: 'Nome completo é obrigatório.' }, 400);
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return jsonResponse({ error: 'Permissão inválida.' }, 400);
  }

  // Bloqueia re-convite de email pertencente a usuário arquivado:
  // admin precisa restaurar manualmente em Administrativo > Arquivados.
  const { data: existing, error: existingErr } = await adminClient
    .from('profiles')
    .select('id, archived_at')
    .eq('email', email)
    .maybeSingle();
  if (existingErr) {
    return jsonResponse(
      { error: existingErr.message ?? 'Falha ao verificar usuário.' },
      500,
    );
  }
  if (existing?.archived_at) {
    return jsonResponse(
      {
        error:
          'Este e-mail pertence a um usuário arquivado. Restaure-o em Administrativo > Arquivados.',
      },
      409,
    );
  }

  const { data: invited, error: inviteErr } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
      redirectTo,
    });

  if (inviteErr) {
    const msg = (inviteErr.message ?? '').toLowerCase();
    if (
      msg.includes('already') ||
      msg.includes('registered') ||
      msg.includes('exists')
    ) {
      return jsonResponse(
        { error: 'Já existe um usuário com este e-mail.' },
        409,
      );
    }
    return jsonResponse(
      { error: inviteErr.message ?? 'Falha ao enviar convite.' },
      500,
    );
  }

  const newUserId = invited?.user?.id;
  if (!newUserId) {
    return jsonResponse({ error: 'Resposta inesperada do Supabase.' }, 500);
  }

  // A trigger handle_new_user já criou a linha em profiles com role default 'sdr'.
  // Atualizamos role + full_name agora.
  const { error: updErr } = await adminClient
    .from('profiles')
    .update({ role, full_name: fullName })
    .eq('id', newUserId);

  if (updErr) {
    return jsonResponse(
      {
        error:
          'Convite enviado, mas falha ao gravar role no perfil: ' +
          updErr.message,
      },
      500,
    );
  }

  return jsonResponse({
    ok: true,
    user: { id: newUserId, email, full_name: fullName, role },
  });
});
