import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase compartilhado entre web (Vite) e mobile (Expo/React Native).
 *
 * Cada app le suas variaveis de ambiente do seu jeito e injeta a config aqui no
 * boot, antes do primeiro acesso ao client:
 *   - web:    initSupabase({ url: import.meta.env.VITE_SUPABASE_URL, anonKey: ... })
 *   - mobile: initSupabase({ url: process.env.EXPO_PUBLIC_SUPABASE_URL, anonKey: ..., authStorage: AsyncStorage })
 *
 * Os modulos de API importam o binding `supabase` (um Proxy) e usam normalmente
 * `supabase.from(...)`, `supabase.rpc(...)`, etc. O Proxy adia o acesso ao client
 * real ate a primeira chamada, garantindo que initSupabase() ja rodou.
 */

let _client = null;

/**
 * Cria uma instancia do client (funcao pura, sem singleton).
 * @param {{ url?: string, anonKey?: string, authStorage?: object }} [config]
 */
export function createSupabaseClient({ url, anonKey, authStorage } = {}) {
  if (!url || !anonKey) {
    throw new Error('createSupabaseClient: faltam url/anonKey do Supabase');
  }
  return createClient(url, anonKey, authStorage
    ? {
        auth: {
          storage: authStorage,
          autoRefreshToken: true,
          persistSession: true,
          // Em React Native nao ha URL para detectar a sessao (so no web/OAuth).
          detectSessionInUrl: false,
        },
      }
    : undefined);
}

/**
 * Inicializa o singleton compartilhado. Chame uma vez no boot de cada app.
 * @param {{ url: string, anonKey: string, authStorage?: object }} config
 */
export function initSupabase(config) {
  _client = createSupabaseClient(config);
  return _client;
}

/** Retorna o client ja inicializado (lanca se initSupabase() nao foi chamado). */
export function getSupabase() {
  if (!_client) {
    throw new Error(
      'Supabase nao inicializado — chame initSupabase({ url, anonKey }) no boot do app antes de usar a API.'
    );
  }
  return _client;
}

/**
 * Binding `supabase` usado pelos modulos de API. E um Proxy que resolve para o
 * client real (via getSupabase) apenas no momento do acesso, de forma que o
 * codigo existente `supabase.from(...)` continua funcionando sem alteracao e sem
 * depender da ordem de import.
 */
export const supabase = /** @type {import('@supabase/supabase-js').SupabaseClient} */ (
  new Proxy(
    {},
    {
      get(_target, prop) {
        const client = getSupabase();
        const value = client[prop];
        return typeof value === 'function' ? value.bind(client) : value;
      },
    }
  )
);
