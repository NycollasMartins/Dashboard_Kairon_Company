# Segurança

Modelo de segurança do Kairon Dashboard, riscos conhecidos e recomendações.

> **Escopo da análise:** código e SQL versionados neste repositório (outubro/2026). O banco de produção pode ter recebido alterações manuais pelo SQL Editor. Todo item marcado **"validar em produção"** precisa ser conferido diretamente no projeto Supabase.

## Sumário

- [Modelo de segurança](#modelo-de-segurança)
- [O que é público e o que é segredo](#o-que-é-público-e-o-que-é-segredo)
- [Riscos conhecidos](#riscos-conhecidos)
- [Checklist de segurança](#checklist-de-segurança)
- [Consultas úteis de auditoria](#consultas-úteis-de-auditoria)

## Modelo de segurança

```
Browser / App ──(anon key + JWT do usuário)──► Supabase (PostgREST / Storage / Realtime)
                                                   │
                                                   └─ RLS decide o que cada linha permite
Browser / App ──(JWT)──► Edge Function ──(service_role, secrets)──► Postgres / APIs externas
```

- **Não há backend próprio.** O front fala direto com o Postgres via PostgREST, e **a única barreira real é o RLS**, junto com as RPCs `SECURITY DEFINER`.
- **Os checks de papel na UI** (`DashboardLayout`, `*PageWrapper`, `RestrictedAccessCard`) **são só experiência de uso.** Qualquer pessoa com um JWT válido pode chamar a API diretamente.
- **Os helpers de autorização** ficam no schema `private` (`private.is_admin()`, `is_strict_admin()`, `is_admin_or_head()`, `is_admin_or_closer()`, `is_sdr_or_bdr()`, etc.), que não é exposto pela Data API.
- **As Edge Functions usam a `service_role`** e, por isso, precisam validar o chamador por conta própria (`auth.getUser()` + `profiles.role`).

## O que é público e o que é segredo

| Item | Classificação | Onde aparece |
|---|---|---|
| URL do projeto Supabase / project ref | Público (vai no bundle) | `VITE_SUPABASE_URL`, `eas.json`, `config.toml`, migration de push |
| Anon key | Público por design | Bundle web e mobile, `eas.json`, migration `20260608000000_push_tokens.sql` |
| `service_role` key | **Segredo** | Somente secrets das Edge Functions. Não aparece no repositório ✅ |
| Tokens Google / Meta / Anthropic | **Segredo** | Somente secrets das Edge Functions ✅ |
| Refresh token do Google Calendar | **Segredo** | Tabela `google_calendar_credentials`, com `REVOKE ALL` para `anon` e `authenticated` ✅ |
| E-mail pessoal de colaborador | **Dado pessoal** | `supabase/triggers/onboarding_on_cliente.sql` ⚠️ |
| Apple Team ID, EAS projectId | Identificadores (não são segredos) | `apps/mobile/app.json` |

> A anon key **não é um segredo**, mas, com o repositório público, qualquer pessoa pode usá-la contra a API. Portanto, tudo o que for liberado para `anon`, ou para qualquer `authenticated` quando o cadastro está aberto, deve ser tratado como **acessível pela internet**.

Em outubro/2026, `supabase/.temp/` (ref, organização, host do pooler) e `.claude/settings.local.json` deixaram de ser versionados e entraram no `.gitignore`. **Eles continuam no histórico do Git.**

## Riscos conhecidos

Ordenados por severidade.

### 1. Escalada de privilégio via `profiles.role`

✅ **Corrigido no código** · 🔴 era crítico · **aplicar a migration em produção**

`supabase/schema.sql`:

```sql
-- Users can update their own profile (non-role fields)
CREATE POLICY "profiles: self update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
```

O comentário dizia "non-role fields", mas a policy não restringe colunas, e o trigger `profiles_archive_guard` só cuidava de `archived_at`, de usuários arquivados e do último admin. Qualquer usuário ativo podia executar:

```js
supabase.from('profiles').update({ role: 'admin' }).eq('id', '<meu-id>')
```

**Correção:** `migrations/20261005000000_profiles_bloqueia_troca_de_papel.sql` cria o trigger `profiles_identity_guard` (`BEFORE UPDATE`). Ele só permite trocar `role` ou `email` quando o chamador é admin (`private.is_strict_admin()`) ou quando a operação vem de contexto de sistema (`auth.uid() IS NULL`: `service_role`, SQL Editor, cron). Convites, a tela Membros e o `manage-user` continuam funcionando.

**Validado** em Postgres local com o schema completo aplicado. Sem o trigger, um `sdr` virava `admin`. Com o trigger, a operação falha com `42501`, e o admin continua trocando papéis.

**Depois de aplicar**, audite quem é admin hoje: `SELECT id, email, created_at FROM public.profiles WHERE role = 'admin';`

### 2. Cadastro aberto e papel padrão `sdr`

✅ **Mitigado no código** · 🔴 era crítico · **aplicar a migration e revisar o painel**

O problema era este:

- o trigger `handle_new_user` criava **todo** usuário novo com `role = 'sdr'`;
- `sdr` lê **todos** os leads (nome, e-mail, telefone, faturamento);
- o login web oferece Google e Apple OAuth, e `auth.signUp` é chamável com a anon key.

Com o signup habilitado, qualquer pessoa ganhava acesso a esses dados.

**Correção:** `migrations/20261005000100_papel_pendente_novos_usuarios.sql`

- Cria o papel **`pendente`**, que passa a ser o default de `profiles.role` e de `handle_new_user`. O convite não muda: o `invite-user` grava o papel real logo em seguida.
- Cria o helper `private.is_member()`, verdadeiro para papel ≠ `pendente` e usuário não arquivado.
- As policies que liberavam dados a **qualquer autenticado** passam a exigir `is_member()`: `profiles` (o próprio perfil continua legível), `squads`, `squad_membros`, `calendar_events`, `event_attendees`, `metas`, `vendas`, `client_folders`, `client_files` e o bucket `client-files`.
- A `user_invites_view`, que roda como owner e ignora o RLS, passa a filtrar por `is_member()`.
- No web, quem é `pendente` vê só a tela "Aguardando aprovação" (`AguardandoAprovacaoPage`). O admin aprova em Membros, trocando o papel.

**Validado** em Postgres local: um usuário `pendente` lê apenas o próprio perfil (0 leads, 0 arquivos, 0 perfis de terceiros) e não consegue gravar em `client_folders` nem no bucket.

**Ainda recomendado:** desligar **Authentication → Providers → "Allow new users to sign up"** (o fluxo oficial é por convite). Depois de aplicar, procure contas criadas sem convite:

```sql
SELECT p.id, p.email, p.role, u.created_at, u.raw_app_meta_data->>'provider' AS provider
FROM public.profiles p JOIN auth.users u ON u.id = p.id
WHERE u.invited_at IS NULL ORDER BY u.created_at DESC;
```

> No **mobile**, um usuário `pendente` não tem tela dedicada. Ele vê as abas Hoje e Calendário vazias, porque o RLS não devolve dados, e não vê a aba Leads.

### 3. `generate-report` sem autenticação de papel

✅ **Corrigido no código** · 🔴 era alto · **fazer redeploy da função**

A função não chamava `auth.getUser()` nem verificava `profiles.role`, e o `verify_jwt` padrão aceita a própria anon key como JWT. Qualquer pessoa podia gerar chamadas pagas à Anthropic.

**Correção:** `supabase/functions/generate-report/index.ts` agora valida o JWT e exige `role = 'admin'` (a mesma regra da tela Relatórios), seguindo o padrão das outras funções. Também rejeita métodos que não sejam `POST`. Para valer em produção, rode `supabase functions deploy generate-report`.

### 4. RPC `create_lead_from_webhook` liberada para `anon`

🟠 **Médio** · confirmado no código

A landing page cria leads chamando a RPC com a anon key, e qualquer um pode fazer o mesmo. Não há rate limit, captcha nem segredo compartilhado. O risco é spam no pipeline e notificações em massa para o time comercial.

**Mitigação:** colocar uma Edge Function na frente da RPC, com segredo compartilhado com a landing page e/ou captcha (Turnstile/reCAPTCHA), e revogar `EXECUTE` de `anon`.

### 5. `push-fanout` chamável por qualquer JWT

🟡 **Baixo** · confirmado no código

A função usa a `service_role` e reenvia o push de uma notificação existente a partir do `notification_id`. O conteúdo é lido do banco, não do corpo da requisição, o que limita o abuso a reenviar notificações já existentes, desde que se conheça o UUID.

**Mitigação:** validar um segredo compartilhado no header, enviado pelo trigger.

### 6. Valores de ambiente fixos no SQL

🟡 **Médio (operacional)**

- `migrations/20260608000000_push_tokens.sql` tem a URL do projeto e a anon key de produção fixas em `private.notifications_push_fanout()`. Em outro ambiente, o push vai para produção.
- `triggers/onboarding_on_cliente.sql` busca o responsável das tarefas de onboarding pelo **e-mail pessoal** de um colaborador. Isso expõe dado pessoal e quebra silenciosamente se a pessoa sair (as tarefas ficam sem responsável).

**Correção:** ler a URL e a chave de `vault.secrets` (Supabase Vault) ou de uma tabela de configuração. Para o onboarding, usar um papel (ex.: primeiro `cs` ativo) ou configuração em tabela.

### 7. Arquivos de cliente com acesso aberto

🟡 **Médio (decisão de negócio)**

A migration `20260601200000_client_files_open_access.sql` liberou ver, enviar e **apagar** arquivos e pastas de **qualquer** cliente para qualquer usuário, substituindo a regra por squad. Desde `20261005000100`, isso vale só para **membros** (não `pendente`), mas continua incluindo papéis como `sdr` e `tv`. Confirme se é intencional.

### 8. Divergência entre UI e RLS

🟡 **Baixo**

Há papéis que o banco libera e a UI esconde, e vice-versa. Não é uma falha de segurança em si, mas confunde quem mantém o sistema. Exemplos em [auth.md](auth.md#divergências-conhecidas).

### 9. CORS `*` nas Edge Functions

ℹ️ **Informativo**

`_shared/cors.ts` usa `Access-Control-Allow-Origin: *`. Isso é aceitável porque todas as rotas exigem JWT. Restringir ao domínio do dashboard reduz a superfície.

## Checklist de segurança

Use antes de cada release e ao subir um ambiente novo.

- [ ] Signup público desligado no Supabase Auth (ou papel padrão sem acesso)
- [ ] Providers OAuth (Google/Apple) restritos ao necessário
- [ ] Redirect URLs do Auth contêm apenas domínios próprios
- [ ] Migrations `20261005000000` e `20261005000100` aplicadas
- [ ] Usuário comum não consegue alterar `profiles.role` (teste com um usuário `sdr`)
- [ ] Todas as Edge Functions validam o chamador (inclusive `generate-report`)
- [ ] Nenhum `.env` real versionado (`git ls-files | grep -E '\.env($|\.)' | grep -v example`)
- [ ] Nenhuma chave de `service_role` ou token de API no repositório
- [ ] Toda tabela nova com `ENABLE ROW LEVEL SECURITY` e policies explícitas
- [ ] Funções `SECURITY DEFINER` novas com `SET search_path` e checagem de papel
- [ ] Buckets novos privados, com acesso por URL assinada

## Consultas úteis de auditoria

Rode no SQL Editor (somente leitura):

```sql
-- Policies de profiles em produção
SELECT policyname, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles';

-- Tabelas públicas SEM RLS
SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;

-- Funções executáveis por anon
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE');

-- Distribuição de papéis (detectar contas inesperadas)
SELECT role, count(*) FROM public.profiles GROUP BY role ORDER BY 2 DESC;
```

> Há também o **Security Advisor** do Supabase (Dashboard → Advisors), que aponta RLS ausente e funções com `search_path` mutável.
