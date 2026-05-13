import { supabase } from '@/infrastructure/supabase/client';

const TABLE = 'tarefas';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/**
 * Postgres rejeita string vazia em colunas `date` e `uuid`.
 * Normaliza opcionais para `null` e remove campos derivados de joins
 * (que voltariam aninhados em updates).
 */
function sanitizeTarefaRow(input) {
  const {
    cliente_nome: _cn,
    responsavel: _r,
    clientes: _c,
    ...data
  } = input;

  const emptyToNull = (v) =>
    v == null || (typeof v === 'string' && v.trim() === '') ? null : v;

  const titulo =
    typeof data.titulo === 'string' ? data.titulo.trim() : data.titulo;

  return {
    ...data,
    titulo,
    prazo: emptyToNull(data.prazo),
    cliente_id: emptyToNull(data.cliente_id),
    projeto_id: emptyToNull(data.projeto_id),
    responsavel_id: emptyToNull(data.responsavel_id),
  };
}

const TAREFA_SELECT = '*, clientes(nome), responsavel:profiles(id,full_name,email)';

export const tarefasApi = {
  list: () =>
    supabase
      .from(TABLE)
      .select(TAREFA_SELECT)
      .order('created_at', { ascending: false })
      .then(unwrap),

  byCliente: (clienteId) =>
    supabase
      .from(TABLE)
      .select(TAREFA_SELECT)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .then(unwrap),

  byProjeto: (projetoId) =>
    supabase
      .from(TABLE)
      .select(TAREFA_SELECT)
      .eq('projeto_id', projetoId)
      .order('created_at', { ascending: false })
      .then(unwrap),

  create: (data) =>
    supabase.from(TABLE).insert(sanitizeTarefaRow(data)).select().single().then(unwrap),

  update: (id, data) =>
    supabase
      .from(TABLE)
      .update(sanitizeTarefaRow(data))
      .eq('id', id)
      .select()
      .single()
      .then(unwrap),

  delete: (id) =>
    supabase.from(TABLE).delete().eq('id', id).then(unwrap),
};
