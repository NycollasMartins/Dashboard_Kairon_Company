import { supabase } from '../supabase/client.js';

const VIEW = 'user_invites_view';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

async function unwrapInvoke({ data, error }) {
  if (error) {
    let message =
      (data && (data.error || data.message)) || error.message || 'Erro ao chamar função.';
    // supabase-js (FunctionsHttpError) guarda a Response do erro em `error.context`.
    // Em algumas versões é a própria Response; em outras vem em `error.context.response`.
    const ctx = error.context;
    const response =
      ctx && typeof ctx.json === 'function'
        ? ctx
        : ctx?.response && typeof ctx.response.json === 'function'
          ? ctx.response
          : null;
    try {
      if (response) {
        const body = await response.json();
        if (body?.error) message = body.error;
        else if (body?.message) message = body.message;
      }
    } catch {
      // body não era JSON — usa o que já tinha
    }
    throw new Error(message);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

function currentOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return undefined;
}

export const invitesApi = {
  list: () =>
    supabase
      .from(VIEW)
      .select('id, email, full_name, role, invited_at, last_sign_in_at, pending')
      .eq('pending', true)
      .order('invited_at', { ascending: false })
      .then(unwrap),

  create: ({ email, full_name, role }) =>
    supabase.functions
      .invoke('invite-user', {
        body: { email, full_name, role, origin: currentOrigin() },
      })
      .then(unwrapInvoke),

  resend: (email) =>
    supabase.functions
      .invoke('invite-user', {
        body: { email, resend: true, origin: currentOrigin() },
      })
      .then(unwrapInvoke),

  cancel: (user_id) =>
    supabase.functions
      .invoke('cancel-invite', { body: { user_id } })
      .then(unwrapInvoke),
};
