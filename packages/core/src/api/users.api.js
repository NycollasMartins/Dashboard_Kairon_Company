import { supabase } from '../supabase/client.js';

const TABLE = 'profiles';
const VIEW = 'user_invites_view';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

async function unwrapInvoke({ data, error }) {
  if (error) {
    let message =
      (data && (data.error || data.message)) || error.message || 'Erro ao chamar função.';
    // supabase-js esconde o body de respostas não-2xx; recuperamos manualmente.
    try {
      const response = error.context?.response;
      if (response && typeof response.json === 'function') {
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

export const usersApi = {
  list: () =>
    supabase
      .from(VIEW)
      .select('id, email, full_name, role, archived_at, last_sign_in_at, status')
      .order('full_name', { ascending: true })
      .then(unwrap),

  update: (id, data) =>
    supabase.from(TABLE).update(data).eq('id', id).select('id, email, full_name, role').single().then(unwrap),

  archive: (user_id) =>
    supabase.functions
      .invoke('manage-user', { body: { user_id, action: 'archive' } })
      .then(unwrapInvoke),

  unarchive: (user_id) =>
    supabase.functions
      .invoke('manage-user', { body: { user_id, action: 'unarchive' } })
      .then(unwrapInvoke),

  remove: (user_id) =>
    supabase.functions
      .invoke('manage-user', { body: { user_id, action: 'delete' } })
      .then(unwrapInvoke),
};
