import { supabase } from '@/infrastructure/supabase/client';

const TABLE = 'leads';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

const LEAD_SELECT =
  '*, responsavel:profiles(id,full_name,email), cliente:clientes(id,nome)';

function sanitize(input) {
  const { responsavel: _r, cliente: _c, ...data } = input;
  const emptyToNull = (v) =>
    v == null || (typeof v === 'string' && v.trim() === '') ? null : v;

  const result = { ...data };
  if ('responsavel_id' in data) result.responsavel_id = emptyToNull(data.responsavel_id);
  if ('cliente_id' in data) result.cliente_id = emptyToNull(data.cliente_id);
  if ('email' in data) result.email = emptyToNull(data.email);
  if ('telefone' in data) result.telefone = emptyToNull(data.telefone);
  if ('empresa' in data) result.empresa = emptyToNull(data.empresa);
  if ('momento_empresa' in data) result.momento_empresa = emptyToNull(data.momento_empresa);
  if ('objetivo_principal' in data) result.objetivo_principal = emptyToNull(data.objetivo_principal);
  if ('notas' in data) result.notas = emptyToNull(data.notas);
  return result;
}

export const leadsApi = {
  list: () =>
    supabase
      .from(TABLE)
      .select(LEAD_SELECT)
      .order('created_at', { ascending: false })
      .then(unwrap),

  update: (id, data) =>
    supabase
      .from(TABLE)
      .update(sanitize(data))
      .eq('id', id)
      .select(LEAD_SELECT)
      .single()
      .then(unwrap),

  delete: (id) =>
    supabase.from(TABLE).delete().eq('id', id).then(unwrap),
};
