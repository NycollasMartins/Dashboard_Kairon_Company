import { supabase } from '@/infrastructure/supabase/client';

const TABLE = 'clientes';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

const LIST_SELECT = '*, responsavel:profiles(id,full_name,email), squads(id,nome)';
const DETAIL_SELECT =
  '*, responsavel:profiles(id,full_name,email), squads(id,nome,squad_membros(profile_id,profiles(id,email,full_name,role)))';

export const clientesApi = {
  list: () =>
    supabase.from(TABLE).select(LIST_SELECT).order('created_at', { ascending: false }).then(unwrap),

  get: (id) =>
    supabase.from(TABLE).select(DETAIL_SELECT).eq('id', id).single().then(unwrap),

  create: (data) =>
    supabase.from(TABLE).insert(data).select(LIST_SELECT).single().then(unwrap),

  update: (id, data) =>
    supabase.from(TABLE).update(data).eq('id', id).select(LIST_SELECT).single().then(unwrap),

  archive: (id) =>
    supabase
      .from(TABLE)
      .update({ status: 'inativo' })
      .eq('id', id)
      .select(LIST_SELECT)
      .single()
      .then(unwrap),
};
