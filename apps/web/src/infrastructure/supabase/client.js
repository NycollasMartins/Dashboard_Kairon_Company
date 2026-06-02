// Shim de compatibilidade — o client real vive em @kairon/core.
// `supabase` aqui e o Proxy do core; a inicializacao acontece em main.jsx
// (initSupabase) antes do primeiro acesso. Todos os imports antigos
// `@/infrastructure/supabase/client` continuam funcionando sem alteracao.
export { supabase } from '@kairon/core/supabase/client';
