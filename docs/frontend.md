# Frontend web (`apps/web`)

React 18 + Vite 6, em JavaScript (JSX), com `checkJs` via `jsconfig.json`. A UI usa Tailwind e shadcn/ui (estilo `new-york`, Radix).

## Sumário

- [Bootstrap e providers](#bootstrap-e-providers)
- [Rotas](#rotas)
- [Layout e navegação](#layout-e-navegação)
- [Estrutura de uma feature](#estrutura-de-uma-feature)
- [Módulos](#módulos)
- [Estado e carregamento de dados](#estado-e-carregamento-de-dados)
- [Componentes e arquivos críticos](#componentes-e-arquivos-críticos)
- [UI e estilo](#ui-e-estilo)
- [Testes](#testes)

## Bootstrap e providers

`src/main.jsx` chama `initSupabase({ url, anonKey })` e renderiza `<App />`.

`src/app/App.jsx`:

```
<BrowserRouter>
  <AuthProvider>                     sessão + profile (features/auth/context/AuthContext.jsx)
    <QueryClientProvider>            TanStack Query (shared/lib/query-client.js → core)
      <NotificationsProvider>        notificações em tempo real, som, modal de meta batida
        <AppContent />               rotas por papel
        <Toaster />
```

## Rotas

| Rota | Componente | Guarda |
|---|---|---|
| `/login` | `auth/pages/LoginPage` | Redireciona para `/` (ou `/metas` se `tv`) quando já autenticado |
| `/aceitar-convite` | `auth/pages/AcceptInvitePage` | Pública. Processa o token do convite e define a senha |
| `/` | `dashboard/pages/VisaoGeralPage` | `ProtectedRoute` + `DashboardLayout` |
| `/calendario` | `calendario/pages/CalendarioPageWrapper` | |
| `/metas` | `metas/pages/MetasPage` | |
| `/comercial` | `comercial/pages/ComercialPage` | `podeUsarCrm` |
| `/campanhas/*` | `campanhas/pages/CampanhasPageWrapper`: lista e `/:campanhaId` | admin |
| `/tarefas` | `tarefas/pages/MinhasTarefasPage` | `TAREFAS_ROLES` |
| `/clientes/*` | `clientes/pages/ClientesPageWrapper`: lista, `/:clienteId` e `/:clienteId/projetos/:projetoId` (Kanban do projeto) | `OPERACIONAL_ROLES` |
| `/squads/*` | `squads/pages/SquadsPageWrapper`: lista e `/:squadId`. O Filmmaker vê só a lista dos seus squads, sem detalhe | admin, head, dev, Filmmaker |
| `/administrativo` | `administrativo/pages/AdministrativoPage` | admin |
| `/financeiro` | `financeiro/pages/FinanceiroPage` | admin |
| `/relatorios` | `relatorios/pages/RelatoriosPage` | admin |
| `*` | `shared/components/PageNotFound` | |

**Conjuntos de rotas por papel** (`App.jsx`):
- `tv`: só `/metas`; qualquer outra rota redireciona para lá.
- `Filmmaker`: `/`, `/calendario`, `/tarefas`, `/squads/*`; o resto redireciona para `/`.
- Demais papéis: todas as rotas, com guardas dentro das páginas (`RestrictedAccessCard`).

O mapa completo de permissões está em [auth.md](auth.md#matriz-de-acesso-ui-web).

## Layout e navegação

- **`DashboardLayout`** (`features/dashboard/pages/`): calcula as flags de papel e renderiza `Sidebar`, `Header` e `<Outlet />`.
- **`Sidebar`** (`shared/components/layout/`): grupos **Comercial**, **Operacional** e **Gestão**, badge de leads não lidos (`leadUnreadCount`), link "Baixar app" (`shared/config/app.js`, que hoje aponta para um **placeholder** da App Store) e logout. No mobile vira drawer.
- **`Header`**: breadcrumbs e `NotificationBell`.

## Estrutura de uma feature

```
features/<modulo>/
├── api/          # shims para @kairon/core/api/* (ou módulos próprios do web)
├── components/   # componentes do domínio (modais, cards, seções)
├── constants/    # opções de selects, enums de UI
├── lib/          # cálculos e helpers puros do domínio
└── pages/        # páginas roteáveis (+ *PageWrapper com guarda de papel e sub-rotas)
```

## Módulos

| Módulo | Principais arquivos | Notas |
|---|---|---|
| **auth** | `LoginPage`, `AcceptInvitePage`, `AuthContext` | E-mail/senha, Google, Apple, "esqueci a senha", aviso de conta arquivada |
| **dashboard** | `VisaoGeralPage`, `KpiCard`, `LeadsChart`, `TeamPerformance`, `AtividadesRecentes` | Painel inicial a partir de tarefas, projetos e squads |
| **calendario** | `CalendarioPage`, `CalendarMonthGrid`, `EventoForm`, `EventoDetalhe`, `googleCalendar.api` | Público do evento: todos, squad, pessoas ou C-level. Conexão e sincronização com Google (admin/head) |
| **metas** | `MetasPage`, `VendaModal`, `MetaValorModal`, `CloserDetalheModal`, `MetaCelebrationModal`, `lib/metas.calc` | Realtime. Ranking de closers. Modo TV |
| **comercial** | `ComercialPage`, `LeadsKanban`, `LeadCard`, `LeadDetalheModal`, `LeadNovoModal`, `ConverterLeadModal` | Kanban drag-and-drop (`@hello-pangea/dnd`) e Realtime |
| **campanhas** | `CampanhasPage`, `CampanhaDetalhePage`, `CampanhaForm` | Usa `lib/adsService` (mock ou Edge Function) |
| **tarefas** | `MinhasTarefasPage`, `ClienteTarefasKanban` | Maior arquivo do projeto (cerca de 1.350 linhas) |
| **projetos** | `ProjetoKanban`, `ProjetosLista` | Usados dentro de cliente e tarefas |
| **clientes** | `ClientesPage`, `ClienteDetalhePage`, `ClienteForm`, `ContratosSection`, `ContratoFormModal`, `CancelarContratoModal`, `HistoricoContratos`, `ClienteArquivos` | Contratos via RPC. Arquivos com upload TUS |
| **squads** | `SquadsPage`, `SquadDetalhePage`, `SquadForm`, `SquadFinanceiroSection` | |
| **administrativo** | `AdministrativoPage`, `InviteUserDialog`, `DeleteUserDialog`, `UserDocumentsDialog`, `lib/roleConfig` | Convites, papéis, arquivamento e documentos |
| **financeiro** | `FinanceiroPage`, `RecorrenciaSection`, `RecebiveisSection`, `ContasPagarSection`, `CustosOperacionais`, `DreProjecaoSection`, `MetricaModal` | Realtime. Todo cálculo vem de `@kairon/core/finance` |
| **relatorios** | `RelatoriosPage`, `ReportBlocks`, `lib/aggregate` | Agrega, chama `generate-report`, renderiza os blocos e exporta PDF (jsPDF + html2canvas) |
| **notifications** | `NotificationsContext`, `NotificationBell` | Canal Realtime `notifications:<user_id>`, som via Web Audio e toasts |

## Estado e carregamento de dados

| Tipo | Ferramenta | Onde |
|---|---|---|
| Dados do servidor | TanStack Query | `useQuery({ queryKey: queryKeys.x.y, queryFn: xApi.list })` |
| Chaves de cache | `queryKeys` | `packages/core/src/entities/query-keys.js` (reexportado em `src/entities/query-keys.js`) |
| Sessão e perfil | `AuthContext` | `useAuth()` → `{ user, isAuthenticated, isLoadingAuth, authChecked, checkUserAuth, logout }` |
| Notificações | `NotificationsContext` | `useNotifications()` → contadores, lista, `leadUnreadCount` |
| Formulários | React Hook Form + Zod | Modais de cadastro |
| Tempo real | `supabase.channel(...)` | Comercial, Financeiro, Metas, Notificações → `invalidateQueries` |

Defaults do QueryClient: `retry: 1` e `refetchOnWindowFocus: false`. Páginas que só admins usam passam `enabled: isAdmin` para não disparar consultas que o RLS negaria.

## Componentes e arquivos críticos

Arquivos que exigem cuidado ao alterar:

| Arquivo | Por quê |
|---|---|
| `packages/core/src/finance/finance.calc.js` | Fonte única dos números de Financeiro, Metas, Relatórios e Squads. Coberto por testes |
| `packages/core/src/supabase/client.js` | Inicialização e Proxy do cliente, compartilhados com o mobile |
| `src/app/App.jsx` + `features/dashboard/pages/DashboardLayout.jsx` | Roteamento e visibilidade por papel |
| `features/auth/context/AuthContext.jsx` | Sessão, arquivamento e fallback de papel |
| `features/clientes/api/arquivos.api.js` | Upload TUS direto no endpoint do Storage, com o JWT do usuário |
| `lib/adsServiceCore.js` | Alterna mock e real (`VITE_ADS_USE_MOCK`) |
| `features/relatorios/components/ReportBlocks.jsx` | Contrato de formato com a Edge Function `generate-report` |

## UI e estilo

- **shadcn/ui** em `src/shared/ui/` (51 arquivos). O alias `@/components/ui` resolve para essa pasta (`vite.config.js`, `jsconfig.json`).
- **Tailwind** com variáveis CSS (`src/index.css`, `tailwind.config.js`). Tema escuro, com a cor da marca `#EA3935`.
- Ícones `lucide-react`, animações `framer-motion`, gráficos `recharts`.

## Testes

```bash
npm test -w apps/web          # vitest run
npm run test:watch -w apps/web
```

| Arquivo | Cobre |
|---|---|
| `features/financeiro/lib/financeiro.calc.test.js` | Cálculos financeiros |
| `features/financeiro/lib/finance.new.test.js` | Módulo financeiro do core (ex.: `receitaDoMes` igual entre Financeiro e Metas) |
| `features/clientes/api/contratos.test.js` | Helpers de contrato (MRR, TCV, LTV) |

Não há testes de componentes nem E2E.
