import { supabase } from '@/infrastructure/supabase/client';

const TABLE = 'profiles';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

export const usersApi = {
  list: () =>
    supabase
      .from(TABLE)
      .select('id, email, full_name, role')
      .order('full_name', { ascending: true })
      .then(unwrap),

  update: (id, data) =>
    supabase.from(TABLE).update(data).eq('id', id).select('id, email, full_name, role').single().then(unwrap),
};
