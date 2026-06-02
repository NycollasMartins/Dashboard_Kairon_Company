import { supabase } from '../supabase/client.js';

/**
 * Busca o profile do app (tabela `profiles`) para um usuario autenticado.
 * Logica pura de acesso a dados, compartilhada por web e mobile.
 */
export async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, archived_at, avatar_url, preferences')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Mapeia o profile + sessao para o objeto de usuario usado pelo app.
 * Nao tem efeito colateral (sem window/redirect) — cada app decide o que fazer
 * com o flag `archived`.
 * @returns {{ user: object|null, archived: boolean }}
 */
export function mapProfileToUser(profile, sessionUser) {
  if (profile?.archived_at) {
    return { user: null, archived: true };
  }
  return {
    user: {
      id: profile.id,
      email: profile.email ?? sessionUser?.email,
      full_name: profile.full_name ?? '',
      role: profile.role ?? 'sdr',
      avatar_url: profile.avatar_url ?? null,
      preferences: profile.preferences ?? {},
    },
    archived: false,
  };
}
