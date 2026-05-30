import { supabase } from '@/infrastructure/supabase/client';

const TABLE = 'calendar_events';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// Campos que a UI envia. Removemos derivados/joins antes de gravar e
// convertemos strings vazias em null para colunas opcionais.
function sanitize(input) {
  const row = {
    title: input.title?.trim() ?? '',
    description: input.description?.trim() || null,
    type: input.type ?? 'meeting',
    start_at: input.start_at,
    end_at: input.end_at,
    all_day: !!input.all_day,
    location: input.location?.trim() || null,
  };
  if (input.google_event_id !== undefined) row.google_event_id = input.google_event_id || null;
  return row;
}

export const calendarioApi = {
  list: () =>
    supabase.from(TABLE).select('*').order('start_at', { ascending: true }).then(unwrap),

  create: (data) =>
    supabase.from(TABLE).insert(sanitize(data)).select('*').single().then(unwrap),

  update: (id, data) =>
    supabase.from(TABLE).update(sanitize(data)).eq('id', id).select('*').single().then(unwrap),

  // Atualização parcial (ex.: gravar google_event_id após sincronizar).
  patch: (id, partial) =>
    supabase.from(TABLE).update(partial).eq('id', id).select('*').single().then(unwrap),

  remove: async (id) => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};
