# Integrações externas

Princípio: **nenhum segredo de terceiros chega ao front.** Toda integração passa por uma Edge Function que lê secrets (`supabase secrets set`) e valida o chamador. O modelo de secrets está em [`supabase/functions/.env.example`](../supabase/functions/.env.example).

| Integração | Status | Edge Function | Secrets |
|---|---|---|---|
| Google Calendar | ✅ Implementada | `google-calendar-oauth`, `google-calendar-sync` | `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`? |
| Meta Marketing API | ✅ Implementada (sem criação) | `meta-ads` | `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_API_VERSION`? |
| Google Ads API | 🚧 Esqueleto (todas as ações retornam 501) | `google-ads` | `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`? |
| Anthropic (Claude) | ✅ Implementada | `generate-report` | `ANTHROPIC_API_KEY` |
| Expo Push | ✅ Implementada | `push-fanout` | — (usa a `service_role` da plataforma) |
| Landing page (entrada de leads) | ✅ Via RPC | — | — (anon key) |

`?` = opcional.

---

## Google Calendar

**Modelo:** um **calendário único da empresa**. Os tokens ficam em `public.google_calendar_credentials` (linha única `id = true`, `REVOKE ALL` para `anon` e `authenticated`), e só as funções acessam via `service_role`.

**Fluxo de conexão (admin):**

1. A tela Calendário chama `googleCalendarApi.getAuthUrl()`, que faz `POST google-calendar-oauth { action: 'authUrl' }`.
2. A função grava `oauth_state` (TTL de 10 min) e devolve a URL de consentimento (escopo `https://www.googleapis.com/auth/calendar`).
3. O Google redireciona para `GET google-calendar-oauth?code&state`. A função valida o `state`, troca o `code` por `refresh_token` e responde com uma página HTML de sucesso ou erro.
4. `google_calendar_status()` (RPC) informa a conexão para a UI.

**Sincronização (admin/head):** `google-calendar-sync` com `push` (cria ou atualiza e grava `google_event_id`), `delete` e `pull` (importa eventos). Usa `google_calendar_id` ou `primary`.

**Configuração:**

1. Google Cloud Console: crie um OAuth Client do tipo "Web application" e habilite a Google Calendar API.
2. Authorized redirect URI: `https://<project-ref>.supabase.co/functions/v1/google-calendar-oauth`, ou o valor de `GOOGLE_CALENDAR_REDIRECT_URI`.
3. Defina os secrets e faça o deploy. `google-calendar-oauth` precisa de `verify_jwt = false`, já configurado em `supabase/config.toml`, ou use `--no-verify-jwt`.

---

## Meta Ads / Google Ads

**Front:** `apps/web/src/lib/adsService.js` → `metaAdsService` / `googleAdsService`, criados por `createAdsService()` em `adsServiceCore.js`.

**Modo mock:** se `VITE_ADS_USE_MOCK !== 'false'` (inclusive quando ausente, o padrão em dev), o serviço devolve dados simulados e determinísticos e **não chama** as funções. O `Dockerfile` usa `VITE_ADS_USE_MOCK=false` por padrão.

**Meta (`meta-ads`), apenas admin:**

| Ação | Implementação |
|---|---|
| `listCampaigns` | Graph API `/<ad_account>/campaigns`, com status e objetivo mapeados para o vocabulário do dashboard |
| `getMetrics` | Insights diários (`time_increment=1`): `spend`, `impressions`, `clicks`, `ctr`, `cpc`, `reach`, `actions`, `action_values` |
| `pauseCampaign` / `resumeCampaign` / `endCampaign` | Atualiza o status para `PAUSED`, `ACTIVE` ou `ARCHIVED` |
| `createCampaign` | **501**: crie no Gerenciador de Anúncios e importe |

`META_ACCESS_TOKEN` deve ser um **System User Token** de longa duração. `META_API_VERSION` tem default `v21.0`.

**Google (`google-ads`):** a validação de auth e de secrets e a troca de refresh token estão prontas, mas **todas as ações retornam 501** (TODO no código, com os endpoints GAQL planejados em comentário).

**ROAS:** ainda não há atribuição de receita real a campanhas. O "ROAS estimado" usa `VITE_RECEITA_POR_CONVERSAO` (default R$ 80) × conversões ÷ gasto (`apps/web/src/lib/adsConfig.js`).

---

## Anthropic: relatórios com IA

- **Tela:** `/relatorios` (admin). `lib/aggregate.js` consolida Financeiro, Metas, Comercial, Campanhas, Clientes e Tarefas.
- **Função:** `generate-report` envia o resumo à Messages API com um system prompt que exige usar **só** os números fornecidos, e devolve `{ resumo, blocks }`.
- **Modelo:** definido na constante `MODEL` de `supabase/functions/generate-report/index.ts`, com `max_tokens: 16000`.
- **Export:** PDF no cliente (jsPDF + html2canvas).
- **Acesso:** somente admin. A função valida JWT e papel, como as demais ([security.md #3](security.md#3-generate-report-sem-autenticação-de-papel)).

---

## Expo Push

Descrito em [mobile.md → Push notifications](mobile.md#push-notifications). Depende de:

- extensão `pg_net`;
- URL e anon key corretas em `private.notifications_push_fanout()`, hoje **fixas** na migration `20260608000000_push_tokens.sql`;
- função `push-fanout` deployada.

---

## Landing page (leads inbound)

A landing page (repositório externo, **não incluído aqui**) cria leads chamando a RPC `create_lead_from_webhook` com a anon key. Exemplo de requisição em [api.md](api.md#webhook-da-landing-page). Cada lead novo gera notificação para o time comercial.
