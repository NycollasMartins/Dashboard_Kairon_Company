import { supabase } from '@/infrastructure/supabase/client';

const TABLE = 'clientes';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

const CONTRATO_EMBED =
  'contratos(id,tipo,valor,duracao_meses,data_inicio,data_fim,status,renovacao_de,data_cancelamento,motivo_cancelamento,entregaveis,notas,created_at,updated_at)';

const LIST_SELECT = `*, responsavel:profiles(id,full_name,email), squads(id,nome), ${CONTRATO_EMBED}`;
const DETAIL_SELECT = `*, responsavel:profiles(id,full_name,email), squads(id,nome,squad_membros(profile_id,profiles(id,email,full_name,role))), ${CONTRATO_EMBED}`;

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
      .update({ status: 'churn' })
      .eq('id', id)
      .select(LIST_SELECT)
      .single()
      .then(unwrap),
};
