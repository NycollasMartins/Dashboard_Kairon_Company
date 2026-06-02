import { supabase } from '../supabase/client.js';

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
    criador: _cr,
    clientes: _c,
    projetos: _p,
    ...data
  } = input;

  const emptyToNull = (v) =>
    v == null || (typeof v === 'string' && v.trim() === '') ? null : v;

  const result = { ...data };
  if (typeof result.titulo === 'string') result.titulo = result.titulo.trim();
  if ('prazo' in data) result.prazo = emptyToNull(data.prazo);
  if ('cliente_id' in data) result.cliente_id = emptyToNull(data.cliente_id);
  if ('projeto_id' in data) result.projeto_id = emptyToNull(data.projeto_id);
  if ('responsavel_id' in data) result.responsavel_id = emptyToNull(data.responsavel_id);

  return result;
}

const TAREFA_SELECT =
  '*, clientes(nome,status), projetos(nome), responsavel:profiles!tarefas_responsavel_id_fkey(id,full_name,email), criador:profiles!tarefas_created_by_fkey(id,full_name,email)';

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
