import { supabase } from '@/infrastructure/supabase/client';

const TABLE = 'notifications';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export const notificationsApi = {
  // Últimas notificações do usuário (RLS já filtra para as próprias).
  list: (limit = 40) =>
    supabase.from(TABLE).select('*').order('created_at', { ascending: false }).limit(limit).then(unwrap),

  markRead: (id) =>
    supabase.from(TABLE).update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null).then(unwrap),

  markAllRead: () =>
    supabase.from(TABLE).update({ read_at: new Date().toISOString() }).is('read_at', null).then(unwrap),

  // Marca como lidas todas as não lidas de um tipo (ex.: 'lead' ao abrir o CRM).
  markTypeRead: (type) =>
    supabase.from(TABLE).update({ read_at: new Date().toISOString() }).eq('type', type).is('read_at', null).then(unwrap),

  remove: async (id) => {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  },
};
