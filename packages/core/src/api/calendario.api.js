import { supabase } from '../supabase/client.js';

const TABLE = 'calendar_events';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// Embeds por coluna. attendees (várias pessoas) vem de event_attendees.
const SELECT =
  '*, squad:squad_id(id,nome), assignee:assignee_id(id,full_name,email), ' +
  'attendees:event_attendees(profile_id, profile:profiles(id,full_name,email))';

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
    // squad só no modo squad; pessoas (modo 'user') vão para event_attendees.
    squad_id: audience === 'squad' ? input.squad_id || null : null,
    assignee_id: null,
  };
  if (input.google_event_id !== undefined) row.google_event_id = input.google_event_id || null;
  return row;
}

// Substitui os participantes (event_attendees) de um evento.
async function syncAttendees(eventId, audienceType, assigneeIds) {
  await supabase.from('event_attendees').delete().eq('event_id', eventId);
  const ids = audienceType === 'user' && Array.isArray(assigneeIds) ? assigneeIds.filter(Boolean) : [];
  if (ids.length) {
    const { error } = await supabase
      .from('event_attendees')
      .insert(ids.map((pid) => ({ event_id: eventId, profile_id: pid })));
    if (error) throw error;
  }
}

export const calendarioApi = {
  list: () =>
    supabase.from(TABLE).select(SELECT).order('start_at', { ascending: true }).then(unwrap),

  create: async (data) => {
    const row = await supabase.from(TABLE).insert(sanitize(data)).select(SELECT).single().then(unwrap);
    await syncAttendees(row.id, data.audience_type, data.assignee_ids);
    return row;
  },

  update: async (id, data) => {
    const row = await supabase.from(TABLE).update(sanitize(data)).eq('id', id).select(SELECT).single().then(unwrap);
    await syncAttendees(id, data.audience_type, data.assignee_ids);
    return row;
  },

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
