// Barril de conveniencia do @kairon/core.
// Infra compartilhada (client, query-keys, query-client, sessao).
// Os modulos de API sao importados por subpath, ex.:
//   import { clientesApi } from '@kairon/core/api/clientes.api';
export * from './supabase/client.js';
export * from './entities/query-keys.js';
export * from './lib/query-client.js';
export * from './auth/session.js';
