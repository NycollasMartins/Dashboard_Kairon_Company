# Setup local

Guia para subir o projeto do zero em uma máquina nova.

## Checklist rápido

- [ ] Node 20+ e npm 10+ instalados
- [ ] `npm install` na raiz
- [ ] Projeto Supabase acessível (próprio de dev, ou acesso ao existente)
- [ ] `apps/web/.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- [ ] Banco com schema, migrations, triggers e cron aplicados (só em projeto novo)
- [ ] Usuário admin criado
- [ ] `npm run dev` abre em `http://localhost:5173` e o login funciona
- [ ] `npm test -w apps/web` passa
- [ ] (Opcional) `apps/mobile/.env` e `npm run mobile`
- [ ] (Opcional) Supabase CLI logado, para deploy de funções e secrets

## 1. Dependências

```bash
git clone https://github.com/NycollasMartins/Dashboard_Kairon_Company.git
cd Dashboard_Kairon_Company
npm install
```

Um único `npm install` na raiz instala `apps/web`, `apps/mobile` e `packages/core` (workspaces). O `postinstall` do mobile roda `scripts/patch-expo-modules-jsi.js`.

## 2. Variáveis de ambiente

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env      # se for rodar o mobile
```

Preencha com os valores de **Supabase → Project Settings → API**. Descrição de cada variável no [README](../README.md#variáveis-de-ambiente).

> Use preferencialmente um **projeto Supabase separado para desenvolvimento**. Apontar o ambiente local para produção significa operar sobre dados reais.

## 3. Banco de dados (projeto Supabase novo)

Se for usar um projeto que já existe, pule esta etapa.

Siga [database.md → Bootstrap de um ambiente novo](database.md#bootstrap-de-um-ambiente-novo). Em resumo, no SQL Editor:

1. `supabase/schema.sql`
2. `supabase/migrations/*.sql`, em ordem de nome
3. `supabase/triggers/*.sql`
4. `supabase/cron/expirar_contratos.sql`

Antes, habilite as extensões `pg_cron` e `pg_net` em **Database → Extensions**.

## 4. Primeiro usuário admin

1. Crie o usuário em **Authentication → Users → Add user** (ou pelo signup, se estiver habilitado).
2. Promova esse usuário:

   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE email = '<seu-email>';
   ```

3. A partir daí, novos usuários entram por convite, na tela **Membros**. Isso exige a função `invite-user` deployada.

## 5. Rodar

```bash
npm run dev            # web → http://localhost:5173
npm run mobile         # Expo dev server
npm run mobile:ios     # build nativo local (Xcode)
```

O app mobile usa `expo-dev-client`, então é preciso um development build (via `mobile:ios`/`mobile:android` ou o perfil `development` do EAS). O Expo Go pode não suportar todos os módulos. Veja [mobile.md](mobile.md).

## 6. Edge Functions (opcional em dev)

O web funciona sem as funções, mas convites, gestão de usuários, Google Calendar, anúncios reais, relatórios e push dependem delas.

```bash
supabase login
supabase link --project-ref <project-ref>
cp supabase/functions/.env.example supabase/functions/.env   # preencha
supabase functions serve --env-file supabase/functions/.env  # local (exige Docker)
# ou deploy direto: supabase functions deploy <nome>
```

`supabase link` cria `supabase/.temp/`, que está no `.gitignore`.

## 7. Verificação

```bash
npm test -w apps/web     # 3 arquivos, 16 testes (Vitest)
npm run build            # build de produção do web
```

> `npm run lint` passa, mas hoje não analisa arquivos, e `npm run typecheck` reporta erros já existentes. Veja [decisions.md → Dívida técnica](decisions.md#dívida-técnica).
