# API

O sistema não tem uma API REST própria. As "APIs" são três:

1. **PostgREST** (CRUD com RLS), usado pelos módulos de `@kairon/core/api`
2. **RPCs Postgres** para operações transacionais e para o webhook de leads
3. **Edge Functions** (Deno) para operações privilegiadas, integrações e IA

## Sumário

- [Edge Functions](#edge-functions)
- [RPCs Postgres](#rpcs-postgres)
- [Módulos de API do core](#módulos-de-api-do-core)
- [Convenções de erro](#convenções-de-erro)

## Edge Functions

Todas ficam em `supabase/functions/<nome>/index.ts` e compartilham `_shared/cors.ts` (CORS `*`, `POST, OPTIONS`, e o helper `jsonResponse`). O front chama via `supabase.functions.invoke(nome, { body })`, que envia o JWT do usuário.

### Padrão de autorização

```ts
const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user } } = await callerClient.auth.getUser();          // 401 se inválido
const { data: profile } = await callerClient.from('profiles').select('role')...;
if (profile.role !== 'admin') return jsonResponse({ error: 'Forbidden' }, 403);
// operações privilegiadas com um client service_role
```

### Catálogo

| Função | Auth | Chamada por | Body | Resposta / efeito |
|---|---|---|---|---|
| `invite-user` | admin | `invitesApi.create/resend` | `{ email, full_name, role, origin }` ou `{ email, resend: true, origin }` | `inviteUserByEmail` com redirect para `<origin>/aceitar-convite`. Valida `role` em `ALLOWED_ROLES` |
| `cancel-invite` | admin | `invitesApi.cancel` | `{ user_id }` | Apaga o usuário que ainda não logou |
| `manage-user` | admin | `usersApi.archive/unarchive/remove` | `{ user_id, action: 'archive' \| 'unarchive' \| 'delete' }` | Ban/unban e `archived_at`, ou exclusão. Bloqueia ação sobre si mesmo e o caso de ficar sem admin |
| `google-calendar-oauth` | admin (POST) · **sem JWT** (GET) | `googleCalendarApi.getAuthUrl/disconnect` | `{ action: 'authUrl' \| 'disconnect' }` | `authUrl` → URL de consentimento com `state` (TTL de 10 min). O **GET** `?code&state` é o callback do Google: troca por `refresh_token` e salva em `google_calendar_credentials`. Responde em HTML |
| `google-calendar-sync` | admin, head | `googleCalendarApi.push/deleteRemote/pull` | `{ action: 'push', event }` · `{ action: 'delete', google_event_id }` · `{ action: 'pull' }` | Cria, atualiza e remove eventos no Google. `pull` importa eventos para `calendar_events`. Renova o access token automaticamente |
| `meta-ads` | admin | `metaAdsService` (`lib/adsServiceCore.js`) | `{ action, platform, ...payload }` | `listCampaigns`, `getMetrics`, `pauseCampaign`, `resumeCampaign`, `endCampaign`. `createCampaign` → 501 |
| `google-ads` | admin | `googleAdsService` | `{ action, platform, ...payload }` | 🚧 **Todas as ações retornam 501** (TODO no código). Só a validação de auth e de secrets está implementada |
| `generate-report` | admin | `relatoriosApi.gerar` | `{ summary: {...}, periodo: string }` | Chama a Anthropic Messages API e devolve `{ resumo, blocks: Block[] }` |
| `push-fanout` | ⚠️ qualquer JWT | Trigger `notifications_push_fanout` (`pg_net`) | `{ notification_id }` | Lê a notificação e os `push_tokens` do dono, envia pela Expo Push API e remove tokens `DeviceNotRegistered` |

`verify_jwt` (em `supabase/config.toml`): `google-calendar-oauth = false` (o callback vem do Google), `google-calendar-sync = true`. As demais usam o padrão da plataforma (`true`).

### Formato de blocos do relatório (`generate-report`)

Mantido em sincronia com `apps/web/src/features/relatorios/components/ReportBlocks.jsx`:

```jsonc
{ "type": "heading",   "text": "Título", "level": 1 }
{ "type": "paragraph", "text": "..." }
{ "type": "kpis",      "items": [{ "label": "Receita do mês", "value": "R$ 32.500", "hint": "MRR + TCV" }] }
{ "type": "chart",     "chartType": "bar|line|area|pie", "title": "...",
                       "data": [{ "name": "Jan", "value": 12000, "value2": 8000 }],
                       "seriesLabels": { "value": "Receita", "value2": "Custos" } }
{ "type": "table",     "title": "...", "columns": ["Cliente", "MRR"], "rows": [["Acme", "R$ 5.000"]] }
{ "type": "divider" }
```

O front agrega os números (`relatorios/lib/aggregate.js`) e envia só os totais consolidados, não as linhas brutas. O modelo é configurado na constante `MODEL` da função.

## RPCs Postgres

| RPC | Chamada em | Parâmetros | Retorno |
|---|---|---|---|
| `create_lead_from_webhook` | `leadsApi.create` e **landing page externa** | `p_nome` (obrigatório), `p_empresa`, `p_email`, `p_telefone`, `p_momento_empresa`, `p_objetivo_principal`, `p_origem` (default `inbound`), `p_faturamento_mensal` | `uuid` do lead |
| `convert_lead_to_cliente` | `leadsApi.convertToCliente` | lead, squad, responsável, entregáveis e dados do cliente | `uuid` do cliente |
| `criar_contrato` | `contratosApi.criar` | `cliente_id, tipo, valor, duracao_meses, data_inicio, entregaveis, notas, closer_id` | contrato |
| `cancelar_contrato` | `contratosApi.cancelar` | `contrato_id, motivo, total_recebido?` | — |
| `expire_due_contracts` | `contratosApi.expirarVencidos` e cron | — | `integer` (quantidade expirada) |
| `apagar_cliente_completo` | `clientesApi.remove` | `p_cliente_id` | — |
| `mrr_base_ativo` / `tcv_mes_ativo` | `metasApi.mrrBase/tcvMesBase` | — | `numeric` |
| `google_calendar_status` | `googleCalendarApi.status` | — | `{ connected, google_calendar_id, ... }` |

### Webhook da landing page

A landing page (outro repositório, **precisa de validação manual**) chama:

```http
POST https://<project-ref>.supabase.co/rest/v1/rpc/create_lead_from_webhook
apikey: <anon-key>
Authorization: Bearer <anon-key>
Content-Type: application/json

{ "p_nome": "Fulano", "p_email": "fulano@exemplo.com", "p_telefone": "11999999999",
  "p_empresa": "Empresa", "p_faturamento_mensal": "30 a 50 mil", "p_origem": "landing_page" }
```

`p_origem` precisa estar em `leads_origem_check`: `inbound`, `outbound`, `landing_page`, `manual`, `indicacao`, `google_ads`, `instagram`, `facebook`, `outro`. Os riscos estão em [security.md #4](security.md#4-rpc-create_lead_from_webhook-liberada-para-anon).

## Módulos de API do core

`packages/core/src/api/*.api.js`. Cada objeto exporta funções que retornam Promises e são usadas como `queryFn`/`mutationFn`:

| Módulo | Funções |
|---|---|
| `clientesApi` | `list`, `get`, `create`, `update`, `archive`, `remove` (RPC) |
| `contratosApi` | `listByCliente`, `criar` (RPC), `cancelar` (RPC), `expirarVencidos` (RPC). Helpers puros: `getContratoAtivo`, `mrrDoCliente`, `tcvHistorico`, `ltvEstimado` |
| `leadsApi` | `list`, `create` (RPC), `update`, `delete`, `convertToCliente` (RPC) |
| `tarefasApi` | `list`, `byCliente`, `byProjeto`, `create`, `update`, `delete` |
| `projetosApi` | `list`, `byCliente`, `get`, `create`, `update`, `delete` |
| `squadsApi` / `squadMembrosApi` | CRUD / `addMembro`, `removeMembro`, `setMembros` |
| `metasApi` | `listMetas`, `upsertMeta`, `deleteMeta`, `listVendasDoMes`, `criarVenda`, `removerVenda`, `mrrBase`, `tcvMesBase`, `listClosers`. Helpers: `competenciaDoMes`, `rangeDoMes` |
| `financeiroApi`, `custosApi`, `parcelasApi`, `financeConfigApi`, `vendasFinApi`, `pagamentosApi` | Métricas de campanha, custos, parcelas (`marcarPago`/`marcarAberto`), saldo inicial, vendas e contas pagas |
| `calendarioApi` | `list`, `create`, `update`, `patch`, `remove`, `listPeople` (sincroniza `event_attendees`) |
| `campanhasApi` | `list`, `get`, `create`, `update`, `updateStatus`, `remove`, `listMetrics`, `upsertMetrics` |
| `invitesApi` | `list` (`user_invites_view`), `create`, `resend`, `cancel` (Edge Functions) |
| `usersApi` | `list`, `update`, `archive`, `unarchive`, `remove` (Edge Function `manage-user`) |

**Somente no web:** `notifications.api.js`, `relatorios.api.js`, `arquivos.api.js` (upload TUS para `client-files` e URLs assinadas), `memberDocs.api.js` (`member-files`), `googleCalendar.api.js` e `lib/adsService*.js` (mock ou real).

## Convenções de erro

- **PostgREST:** os módulos usam um `unwrap({ data, error })` que lança `error`, e o TanStack Query o expõe em `error`.
- **Edge Functions:** respondem `{ error: string }` com o status HTTP adequado (400, 401, 403, 405, 500, 501, 502). Os wrappers do front (`unwrapInvoke` em `relatorios.api.js` e `googleCalendar.api.js`) leem o corpo para mostrar a mensagem real em vez de "non-2xx status code".
- **RPCs:** `RAISE EXCEPTION` com mensagens em português e `ERRCODE 42501` em violações de permissão.
