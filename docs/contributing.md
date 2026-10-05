# Contribuição e manutenção

## Onboarding de um dev novo

Ordem de leitura sugerida (cerca de 1 hora):

1. [README](../README.md): visão geral e funcionalidades
2. [architecture.md](architecture.md): monorepo, `@kairon/core` e fluxo de dados
3. [auth.md](auth.md): papéis e matriz de acesso
4. [database.md](database.md): tabelas, RLS e RPCs
5. [security.md](security.md): **riscos conhecidos (leitura obrigatória)**
6. [setup.md](setup.md): suba o ambiente local

**Primeiras tarefas sugeridas para ganhar contexto:** ler `packages/core/src/finance/finance.calc.js` junto com os testes, seguir o fluxo de criação de um contrato (`ContratoFormModal` → `contratosApi.criar` → RPC `criar_contrato`) e o de entrada de um lead (`create_lead_from_webhook` → trigger → notificação → `LeadsKanban`).

## Fluxo de trabalho

1. Crie um branch a partir de `main`: `feat/<descricao>`, `fix/<descricao>`, `chore/<descricao>` ou `refactor/<descricao>`.
2. Faça commits pequenos, no padrão do histórico:

   ```
   feat/ financeiro: aba "Contas a Pagar" dos custos mensais
   fix/ tarefas: corrige filtro por responsável
   chore: ignora dumps/backups de banco (.sql/.dump)
   ```

   O formato é `tipo/ escopo: descrição`, com o escopo sendo o módulo (`financeiro`, `comercial`, `metas`, `mobile`...) e a descrição em português, no imperativo ou descritiva.
3. Antes de abrir o PR:

   ```bash
   npm test -w apps/web
   npm run build
   ```

4. No PR, descreva **o que** mudou e **por quê**, as migrations necessárias (com a ordem de aplicação), os secrets novos e como testar.

## Onde colocar cada coisa

| Você vai... | Coloque em |
|---|---|
| Acessar uma tabela nova ou criar uma query | `packages/core/src/api/<modulo>.api.js` (+ shim em `apps/web/src/features/<modulo>/api/`) |
| Criar uma chave de cache | `packages/core/src/entities/query-keys.js` |
| Escrever um cálculo financeiro | `packages/core/src/finance/finance.calc.js` + teste |
| Criar uma tela web | `apps/web/src/features/<modulo>/pages/` + rota em `src/app/App.jsx` + item em `Sidebar.jsx` |
| Criar um componente genérico de UI | `apps/web/src/shared/ui/` (via shadcn: `npx shadcn@latest add <comp>`) |
| Escrever uma regra de permissão | **Banco** (policy/RPC) e depois o espelho na UI |
| Fazer uma operação com segredo ou API externa | `supabase/functions/<nome>/index.ts` |
| Mudar o schema | `supabase/migrations/YYYYMMDDHHMMSS_<descricao>.sql` (idempotente) |
| Agendar um job | `pg_cron`, registrado em `supabase/cron/` ou na migration |
| Criar uma tela mobile | `apps/mobile/src/app/` (Expo Router) |

## Convenções de código

- **Idioma:** domínio em português (`clientes`, `contratos`, `tarefas`, `podeUsarCrm`); infraestrutura e bibliotecas em inglês.
- **Linguagem:** web e core em JavaScript (JSX/ESM); mobile e Edge Functions em TypeScript.
- **Imports no web:** use os aliases `@/...` (raiz `src`) e `@/components/ui/...` (shadcn).
- **Dados:** sempre TanStack Query com `queryKeys`. Depois de mutar, faça `invalidateQueries` da chave afetada.
- **Erros:** os módulos de API lançam erro (`unwrap`). As telas mostram com toast.
- **Comentários:** explique o *porquê* e as premissas de negócio, no estilo de `finance.calc.js` e das migrations.
- **Datas:** para colunas SQL `date`, use `parseDateLocal()` do core e nunca `new Date('YYYY-MM-DD')`, que causa off-by-one por UTC.
- **Papéis:** use o valor exato (`'social media'`, `'Filmmaker'`).

## Checklist de PR

- [ ] Testes passam e o build passa
- [ ] Nenhum segredo, `.env` ou dado pessoal novo no diff
- [ ] Toda regra de acesso nova está no banco (RLS/RPC), não só na UI
- [ ] Migration idempotente, com cabeçalho explicando o porquê
- [ ] Cálculo novo está em `@kairon/core/finance` e tem teste
- [ ] Mudou papel ou permissão? Atualize [auth.md](auth.md)
- [ ] Mudou tabela, RPC ou trigger? Atualize [database.md](database.md)
- [ ] Mudou Edge Function ou secret? Atualize [api.md](api.md), [integrations.md](integrations.md) e `supabase/functions/.env.example`
- [ ] Variável de ambiente nova? Atualize o `.env.example` correspondente, o README e (se for de build) o `Dockerfile`

## Arquivos sensíveis para manutenção

| Arquivo | Risco ao alterar |
|---|---|
| `supabase/schema.sql` e `migrations/*` | Afeta dados de produção. Sem rollback automático |
| `packages/core/src/finance/finance.calc.js` | Muda números de várias telas ao mesmo tempo |
| `packages/core/src/supabase/client.js` | Quebra web e mobile |
| `supabase/functions/invite-user`, `manage-user` | Usam `service_role`. Um erro de autorização é crítico |
| `apps/web/src/app/App.jsx`, `DashboardLayout.jsx` | Visibilidade por papel |
| `apps/mobile/scripts/patch-expo-modules-jsi.js` | Build iOS |
| `Dockerfile`, `nginx.conf` | Deploy de produção |

## Mantenedores

O histórico de commits tem dois contribuidores principais. O repositório foi migrado da conta `assessoriakairon-art` para `NycollasMartins` em outubro/2026, com todo o histórico preservado.
