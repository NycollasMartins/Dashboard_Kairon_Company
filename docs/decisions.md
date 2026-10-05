# Decisões de arquitetura e dívida técnica

Registros curtos no formato ADR. A motivação vem dos comentários do próprio código e das migrations. Quando ela foi inferida, isso está indicado.

## ADRs

### ADR-001: Supabase como backend completo, sem API própria

- **Decisão:** os clientes falam direto com o Postgres via PostgREST. A autorização fica em RLS e RPCs `SECURITY DEFINER`, e o que exige segredo vai para Edge Functions.
- **Motivo (inferido):** time pequeno, um único produto interno e velocidade de entrega.
- **Consequências:** toda regra de acesso **precisa** estar no banco, porque a UI é contornável. As regras de negócio ficam divididas entre SQL (RPCs/triggers) e JS (`finance.calc`).

### ADR-002: Monorepo com `@kairon/core` sem etapa de build

- **Decisão:** npm workspaces (`apps/*`, `packages/*`). O core é ESM puro, consumido como fonte, com `exports` por subpath. Os módulos de API do web viraram shims de reexportação.
- **Motivo:** compartilhar cliente, APIs e cálculos entre web e mobile sem duplicar código (branch `chore/monorepo-extraction`).
- **Consequências:** o core não pode usar `import.meta.env` (Vite) nem APIs de DOM ou React Native, e recebe a configuração por `initSupabase()`. O Metro precisou de `unstable_enablePackageExports`.

### ADR-003: Cliente Supabase como Proxy lazy

- **Decisão:** `supabase` é um `Proxy` que resolve `getSupabase()` na hora do acesso.
- **Motivo:** cada app injeta a configuração no boot, e os imports antigos (`supabase.from(...)`) continuam funcionando sem depender da ordem de import.

### ADR-004: Módulo único de cálculo financeiro

- **Decisão:** `packages/core/src/finance/finance.calc.js` é a fonte única dos números de Financeiro, Metas, Relatórios e Squads.
- **Premissas de reconhecimento (combinadas com o cliente):** MRR reconhecido mensalmente na vigência; TCV com 100% no mês do fechamento (caixa), com visão linear opcional; caixa real = parcelas pagas; receita do mês = MRR ativo + TCV do mês + vendas avulsas.
- **Consequências:** cálculos agregados que closers e TV precisam ver sem acesso a contratos são feitos em SQL (`mrr_base_ativo`, `tcv_mes_ativo`) e **precisam continuar consistentes** com o JS.

### ADR-005: Operações críticas como RPCs atômicas

- **Decisão:** `criar_contrato`, `cancelar_contrato`, `convert_lead_to_cliente` e `apagar_cliente_completo` são RPCs.
- **Motivo:** atomicidade (lead → cliente; contrato → venda → parcelas), validação de papel no servidor, e a FK `contratos.cliente_id ON DELETE RESTRICT`.

### ADR-006: Segredos de terceiros apenas em Edge Functions

- **Decisão:** Google, Meta, Anthropic e `service_role` vivem só nos secrets das funções. Os tokens OAuth do Calendar ficam em uma tabela inacessível a `anon` e `authenticated`.
- **Consequências:** cada função deve validar o chamador por conta própria (hoje `generate-report` não faz isso; veja [security.md](security.md)).

### ADR-007: Migrations idempotentes aplicadas pelo SQL Editor

- **Decisão:** todo SQL é reaplicável (`IF NOT EXISTS`, `DROP ... IF EXISTS`, `CREATE OR REPLACE`).
- **Consequências:** o bootstrap é manual (schema → migrations → triggers → cron), sem rastreio formal do que foi aplicado em cada ambiente. Veja a dívida técnica #4.

### ADR-008: Anúncios com modo mock por padrão

- **Decisão:** `VITE_ADS_USE_MOCK` diferente de `'false'` retorna dados simulados.
- **Motivo:** a UI funciona localmente sem credenciais de mídia. Produção usa `false` via Dockerfile.

### ADR-009: Calendário único da empresa no Google

- **Decisão:** uma conexão OAuth global (linha única), em vez de uma por usuário.
- **Consequências:** só admin conecta. Sincronizar é admin/head.

### ADR-010: Notificações em tabela + Realtime + push via `pg_net`

- **Decisão:** eventos de negócio inserem em `notifications`. O web assina o Realtime, e um trigger chama `push-fanout` para o mobile.
- **Consequências:** a URL e a anon key do projeto ficaram fixas na função SQL do trigger (dívida técnica #3).

## Dívida técnica

| # | Item | Impacto | Sugestão |
|---|---|---|---|
| 1 | **Riscos de segurança** de [security.md](security.md) (autoescalada de `role`, signup aberto, `generate-report` sem auth) | Crítico | Prioridade máxima |
| 2 | **ESLint inefetivo:** `apps/web/eslint.config.js` aplica regras só a `src/components/**`, `src/pages/**` e `src/Layout.jsx`, que não existem | Bugs passam sem aviso | Trocar os globs por `src/**/*.{js,jsx}` e ignorar `src/shared/ui/**` |
| 3 | **Valores fixos de ambiente no SQL:** URL e anon key em `20260608000000_push_tokens.sql`, e-mail em `triggers/onboarding_on_cliente.sql` | Ambientes novos quebram ou apontam para produção. Expõe dado pessoal | Supabase Vault ou tabela de config |
| 4 | **Bootstrap fora do Supabase CLI:** `schema.sql` não é uma migration | `supabase db reset` e branches de preview não funcionam | Gerar uma migration baseline (`supabase db dump`) e passar a usar `supabase db push` |
| 5 | **Typecheck com cerca de 970 erros** (`tsc -p jsconfig.json`) | O `checkJs` perde valor | Corrigir gradualmente ou restringir o `include` |
| 6 | **Sem CI** | Testes e build não rodam em PRs | GitHub Actions com `npm ci`, `npm test -w apps/web` e `npm run build` |
| 7 | **Papéis fixos no código em vários lugares**, com divergências entre menu e guarda | Bugs de acesso, manutenção difícil | Matriz central em `@kairon/core` ([auth.md](auth.md#divergências-conhecidas)) |
| 8 | **`MinhasTarefasPage.jsx` com cerca de 1.350 linhas** | Difícil de manter e testar | Extrair Kanban, filtros e modais |
| 9 | **Google Ads só no esqueleto** | A funcionalidade aparece na UI, mas não funciona no modo real | Implementar ou esconder a plataforma quando não houver mock |
| 10 | **`APP_DOWNLOAD_URL` placeholder** (`shared/config/app.js`) | O link "Baixar app" leva à home da App Store | Atualizar quando a Apple liberar a distribuição |
| 11 | **Dependências sem nenhum import em `apps/web/src`:** `@stripe/react-stripe-js`, `@stripe/stripe-js`, `three`, `react-leaflet`, `moment`, `react-quill`, `canvas-confetti`, `lodash`. Além disso, há três sistemas de toast (`react-hot-toast`, `sonner` e o toaster do shadcn) | Instalação mais lenta e superfície de dependências maior | Remover após confirmar com `npx depcheck` |
| 12 | **Testes cobrem só cálculo** | Regressões de UI e RLS não são detectadas | Testes de policies (pgTAP ou scripts com usuários de teste) e E2E (Playwright) dos fluxos críticos |
| 13 | **Valores Supabase em texto no `eas.json`** | Acopla o repositório a um ambiente | EAS Environment Variables |
| 14 | **Edge Functions sem import map** (`esm.sh` com versão fixa em cada arquivo) | Atualizar o supabase-js exige editar 9 arquivos | `deno.json` com import map compartilhado |
