import { supabase } from '../supabase/client.js';

const TABLE = 'squads';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export const squadsApi = {
  list: () =>
    supabase
      .from(TABLE)
      .select('*, squad_membros(profile_id, profiles(id, email, full_name, role))')
      .order('created_at', { ascending: false })
      .then(unwrap),

  get: (id) =>
    supabase
      .from(TABLE)
      .select('*, squad_membros(profile_id, profiles(id, email, full_name, role))')
      .eq('id', id)
      .single()
      .then(unwrap),

  create: (data) =>
    supabase.from(TABLE).insert(data).select().single().then(unwrap),

  update: (id, data) =>
    supabase.from(TABLE).update(data).eq('id', id).select().single().then(unwrap),

  delete: (id) =>
    supabase.from(TABLE).delete().eq('id', id).then(unwrap),
};
