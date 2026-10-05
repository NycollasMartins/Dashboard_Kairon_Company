# Troubleshooting

## Sumário

- [Ambiente e build](#ambiente-e-build)
- [Autenticação e convites](#autenticação-e-convites)
- [Dados e permissões](#dados-e-permissões)
- [Edge Functions](#edge-functions)
- [Integrações](#integrações)
- [Push notifications](#push-notifications)
- [Mobile](#mobile)
- [Ferramentas de diagnóstico](#ferramentas-de-diagnóstico)

## Ambiente e build

| Sintoma | Causa | Solução |
|---|---|---|
| Erro `createSupabaseClient: faltam url/anonKey do Supabase` | `.env.local` ausente ou sem `VITE_SUPABASE_*` | Crie `apps/web/.env.local` a partir de `apps/web/.env.example` e reinicie o `npm run dev` |
| Erro `Supabase nao inicializado — chame initSupabase(...)` | Algum módulo acessou o cliente antes do `main.jsx`, ou o core foi importado fora do app | Garanta que `initSupabase()` rode no entry point antes do render |
| `Cannot find module '@kairon/core/...'` | Dependências instaladas fora da raiz | Rode `npm install` **na raiz** do monorepo |
| Variável alterada não surte efeito em produção | `VITE_*` são resolvidas no build | Rebuild da imagem (as build args do EasyPanel) |
| Rotas dão 404 ao recarregar em produção | Servidor sem fallback de SPA | Use o `nginx.conf` do repositório (`try_files ... /index.html`) |
| `npm run build` não mostra nada | `logLevel: 'error'` em `vite.config.js` | É o comportamento normal. Confira `apps/web/dist/` |
| `npm run typecheck` com centenas de erros | Dívida técnica (JS com `checkJs`) | Conhecido. Não bloqueia o build ([decisions.md](decisions.md#dívida-técnica)) |

## Autenticação e convites

| Sintoma | Causa | Solução |
|---|---|---|
| Login redireciona para `/login?reason=archived` | `profiles.archived_at` preenchido | Um admin restaura o usuário em Membros (`manage-user` → `unarchive`) |
| O usuário loga, mas aparece como `sdr` e sem acesso | Falha ao ler `profiles` (linha ausente ou erro de rede). O `AuthContext` usa `sdr` como fallback | Confira se existe a linha em `profiles` para o `auth.users.id`, e o trigger `on_auth_user_created` |
| O link do convite abre o domínio errado ou dá erro de redirect | Origem não cadastrada nas Redirect URLs | Adicione `<origem>/aceitar-convite` em Auth → URL Configuration. Confira `VITE_SITE_URL` e o secret `SITE_URL` |
| "Missing auth token" / "Forbidden: admin only" ao convidar | Sessão expirada, ou o usuário não é `admin` | Faça login de novo. Só `admin` (não `dev`) convida |
| Erro "Não é possível remover o último admin ativo" | Proteção do trigger `profiles_archive_guard` | Promova outro admin antes |
| "Esqueci a senha" não chega | SMTP padrão do Supabase com limite de envio | Configure SMTP próprio em Auth → SMTP Settings |

## Dados e permissões

| Sintoma | Causa | Solução |
|---|---|---|
| A lista vem vazia sem erro | O RLS filtrou todas as linhas para esse papel | Comportamento esperado. Confira a matriz em [auth.md](auth.md) |
| O item aparece no menu, mas a página mostra "Acesso restrito" | Divergência entre o menu e a guarda da página | Veja [auth.md → Divergências](auth.md#divergências-conhecidas) |
| `new row violates row-level security policy` | Insert ou update sem policy para o papel | Use a RPC correspondente (ex.: contratos via `criar_contrato`) ou ajuste a policy |
| Não consigo apagar o cliente (FK) | `contratos.cliente_id ON DELETE RESTRICT` | Use `apagar_cliente_completo`, que é o `clientesApi.remove` |
| Não consigo marcar o cliente como churn | Há contrato ativo (trigger `clientes_block_churn_if_active_contract`) | Cancele ou deixe expirar o contrato primeiro |
| Contratos vencidos continuam "ativos" | O job `expirar-contratos` não está agendado | `SELECT * FROM cron.job;` e reaplique `supabase/cron/expirar_contratos.sql` |
| Os números do Financeiro e das Metas diferem | A tela não está usando o core | Todo cálculo deve vir de `@kairon/core/finance/finance.calc` |
| O Realtime não atualiza a tela | Tabela fora da publicação `supabase_realtime`, ou RLS bloqueando | `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime';` |

## Edge Functions

| Sintoma | Causa | Solução |
|---|---|---|
| `Edge Function returned a non-2xx status code` | Erro dentro da função | Os wrappers `unwrapInvoke` extraem `body.error`. Veja os logs em Dashboard → Edge Functions → Logs |
| `Server misconfigured.` | Variáveis da plataforma ausentes (raro) | Redeploy da função |
| `ANTHROPIC_API_KEY não configurada` | Secret ausente | `supabase secrets set ANTHROPIC_API_KEY=...` |
| CORS no navegador | A função não respondeu ao `OPTIONS`, ou caiu antes | Confira os logs. Todas as funções tratam `OPTIONS` com `_shared/cors.ts` |

## Integrações

| Sintoma | Causa | Solução |
|---|---|---|
| Campanhas mostram "Campanha ... (exemplo)" | Modo mock ativo | `VITE_ADS_USE_MOCK=false` + secrets `META_*` |
| Google Ads retorna 501 | Integração ainda não implementada | Esperado ([integrations.md](integrations.md#meta-ads--google-ads)) |
| Callback do Google Calendar dá 401 | Função com `verify_jwt` ligado | Deploy com `config.toml` (`verify_jwt = false`) ou `--no-verify-jwt` |
| "Google Calendar não conectado" | Sem `refresh_token` salvo | Admin reconecta em Calendário |
| Página "Estado inválido" ou "Link expirado" no callback | Mais de 10 min entre gerar a URL e consentir, ou duas tentativas simultâneas | Gere a URL de novo |

## Push notifications

Checklist, em ordem:

1. O dispositivo é **físico**? Simulador não recebe push.
2. O token foi salvo? `SELECT * FROM push_tokens WHERE user_id = '<id>';`
3. A notificação foi criada? `SELECT * FROM notifications WHERE user_id = '<id>' ORDER BY created_at DESC LIMIT 5;`
4. O `pg_net` disparou? `SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;`
5. A URL e a anon key em `private.notifications_push_fanout()` são do **projeto correto**? Elas estão fixas na migration `20260608000000_push_tokens.sql`.
6. Os logs da função `push-fanout` mostram erro da Expo?

## Mobile

| Sintoma | Causa | Solução |
|---|---|---|
| Build iOS falha com `xcodebuild error 65` (`weak let`) | `expo-modules-jsi` incompatível com o Xcode 26 | O `postinstall` aplica o patch. Rode `npm install` de novo ou `node apps/mobile/scripts/patch-expo-modules-jsi.js` |
| Metro não encontra `@kairon/core/api/...` | Resolução de `exports` desligada | Já habilitada em `metro.config.js`. Limpe o cache com `npx expo start -c` |
| O app abre no Expo Go e quebra | O projeto usa `expo-dev-client` | Use um development build |
| Aba Leads não aparece | Papel fora de `ROLES_COMERCIAL` | Esperado para papéis não comerciais |

## Ferramentas de diagnóstico

- **Supabase Dashboard → Logs:** API, Auth, Postgres e Edge Functions.
- **Supabase Dashboard → Advisors:** problemas de segurança e performance (RLS, índices).
- **React Query Devtools:** não instalado. Pode ser adicionado em dev para inspecionar o cache.
- **SQL útil:** consultas de auditoria em [security.md](security.md#consultas-úteis-de-auditoria).
