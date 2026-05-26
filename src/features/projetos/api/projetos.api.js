import { supabase } from '@/infrastructure/supabase/client';

const TABLE = 'projetos';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/** Postgres `date` rejects `''`; optional deadline must be null when empty. */
function sanitizeProjetoRow({ cliente_nome: _ignored, ...data }) {
  const prazo =
    data.prazo != null && String(data.prazo).trim() !== '' ? data.prazo : null;
  return { ...data, prazo };
}

export const projetosApi = {
  list: () =>
    supabase
      .from(TABLE)
      .select('*, clientes(nome)')
      .order('created_at', { ascending: false })
      .then(unwrap),

  byCliente: (clienteId) =>
    supabase
      .from(TABLE)
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .then(unwrap),

  get: (id) =>
    supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single()
      .then(unwrap),

  create: (data) =>
    supabase
      .from(TABLE)
      .insert(sanitizeProjetoRow(data))
      .select()
      .single()
      .then(unwrap),

  update: (id, data) =>
    supabase
      .from(TABLE)
      .update(sanitizeProjetoRow(data))
      .eq('id', id)
      .select()
      .single()
      .then(unwrap),

  delete: (id) =>
    supabase.from(TABLE).delete().eq('id', id).then(unwrap),
};
