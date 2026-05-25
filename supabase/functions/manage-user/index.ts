// supabase/functions/manage-user/index.ts
//
// Edge Function: arquiva, restaura ou exclui usuários. Admin only.
// Body JSON: { user_id, action: 'archive' | 'unarchive' | 'delete' }
//
// archive   -> bane em auth.users (ban_duration ~100 anos), marca
//              profiles.archived_at = now() e remove de squad_membros.
// unarchive -> remove ban e limpa archived_at. NÃO recompõe squads.
// delete    -> apaga em auth.users (CASCADE remove profiles e
//              squad_membros; clientes/tarefas/leads/contratos ficam
//              com responsavel_id / created_by = NULL via SET NULL).
//
// Defesas: admin não pode aplicar a si mesmo; bloqueia operação que
// deixaria o sistema sem nenhum admin ativo.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const FOREVER_BAN = '876000h'; // ≈ 100 anos

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

  let body: { user_id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body.' }, 400);
  }

  const userId = (body.user_id ?? '').trim();
  const action = (body.action ?? '').trim();

  if (!userId) {
    return jsonResponse({ error: 'user_id é obrigatório.' }, 400);
  }
  if (!['archive', 'unarchive', 'delete'].includes(action)) {
    return jsonResponse({ error: 'action inválida.' }, 400);
  }
  if (userId === caller.id) {
    return jsonResponse(
      { error: 'Você não pode aplicar essa ação a si mesmo.' },
      400,
    );
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: target, error: targetErr } = await adminClient
    .from('profiles')
    .select('id, email, role, archived_at')
    .eq('id', userId)
    .single();

  if (targetErr || !target) {
    return jsonResponse({ error: 'Usuário não encontrado.' }, 404);
  }

  async function countActiveAdmins(): Promise<number> {
    const { count, error } = await adminClient
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .is('archived_at', null);
    if (error) throw error;
    return count ?? 0;
  }

  if (action === 'archive') {
    if (target.archived_at) {
      return jsonResponse({ ok: true, already: true });
    }
    if (target.role === 'admin') {
      const activeAdmins = await countActiveAdmins();
      if (activeAdmins <= 1) {
        return jsonResponse(
          { error: 'Não é possível arquivar o último admin ativo.' },
          409,
        );
      }
    }

    const { error: banErr } = await adminClient.auth.admin.updateUserById(
      userId,
      { ban_duration: FOREVER_BAN },
    );
    if (banErr) {
      return jsonResponse(
        { error: banErr.message ?? 'Falha ao bloquear o login.' },
        500,
      );
    }

    const { error: updErr } = await adminClient
      .from('profiles')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', userId);
    if (updErr) {
      return jsonResponse(
        { error: updErr.message ?? 'Falha ao arquivar perfil.' },
        500,
      );
    }

    // Remove de todos os squads — acesso a clientes precisa cair imediatamente.
    const { error: sqErr } = await adminClient
      .from('squad_membros')
      .delete()
      .eq('profile_id', userId);
    if (sqErr) {
      return jsonResponse(
        { error: sqErr.message ?? 'Falha ao remover de squads.' },
        500,
      );
    }

    return jsonResponse({ ok: true, archived: true });
  }

  if (action === 'unarchive') {
    if (!target.archived_at) {
      return jsonResponse({ ok: true, already: true });
    }

    const { error: unbanErr } = await adminClient.auth.admin.updateUserById(
      userId,
      { ban_duration: 'none' },
    );
    if (unbanErr) {
      return jsonResponse(
        { error: unbanErr.message ?? 'Falha ao restaurar login.' },
        500,
      );
    }

    const { error: updErr } = await adminClient
      .from('profiles')
      .update({ archived_at: null })
      .eq('id', userId);
    if (updErr) {
      return jsonResponse(
        { error: updErr.message ?? 'Falha ao restaurar perfil.' },
        500,
      );
    }

    return jsonResponse({ ok: true, unarchived: true });
  }

  // action === 'delete'
  if (target.role === 'admin' && !target.archived_at) {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) {
      return jsonResponse(
        { error: 'Não é possível excluir o último admin ativo.' },
        409,
      );
    }
  }

  const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
  if (delErr) {
    return jsonResponse(
      { error: delErr.message ?? 'Falha ao excluir usuário.' },
      500,
    );
  }

  return jsonResponse({ ok: true, deleted: true });
});
