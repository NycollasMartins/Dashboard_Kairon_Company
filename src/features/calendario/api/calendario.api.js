import { supabase } from '@/infrastructure/supabase/client';

const TABLE = 'calendar_events';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// Embeds por coluna (assignee_id e created_by apontam para profiles -> precisa do hint).
const SELECT = '*, squad:squad_id(id,nome), assignee:assignee_id(id,full_name,email)';

// Campos que a UI envia. Removemos derivados/joins antes de gravar e
// convertemos strings vazias em null para colunas opcionais.
function sanitize(input) {
  const audience = input.audience_type ?? 'all';
  const row = {
    title: input.title?.trim() ?? '',
    description: input.description?.trim() || null,
    type: input.type ?? 'meeting',
    start_at: input.start_at,
    end_at: input.end_at,
    all_day: !!input.all_day,
    location: input.location?.trim() || null,
    audience_type: audience,
    // só preenche o alvo correspondente ao modo escolhido
    squad_id: audience === 'squad' ? input.squad_id || null : null,
    assignee_id: audience === 'user' ? input.assignee_id || null : null,
  };
  if (input.google_event_id !== undefined) row.google_event_id = input.google_event_id || null;
  return row;
}

export const calendarioApi = {
  list: () =>
    supabase.from(TABLE).select(SELECT).order('start_at', { ascending: true }).then(unwrap),

  create: (data) =>
    supabase.from(TABLE).insert(sanitize(data)).select(SELECT).single().then(unwrap),

  update: (id, data) =>
    supabase.from(TABLE).update(sanitize(data)).eq('id', id).select(SELECT).single().then(unwrap),

  // Pessoas ativas para atribuição (profiles é legível por todo autenticado).
  listPeople: () =>
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .is('archived_at', null)
      .order('full_name', { ascending: true })
      .then(unwrap),

  // Atualização parcial (ex.: gravar google_event_id após sincronizar).
  patch: (id, partial) =>
    supabase.from(TABLE).update(partial).eq('id', id).select('*').single().then(unwrap),

  remove: async (id) => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};
