# Deploy

| Peça | Onde roda | Como publica |
|---|---|---|
| Web (`apps/web`) | Container Docker (Nginx) no **EasyPanel** | Build da imagem a partir do `Dockerfile` da raiz |
| Banco (schema, RLS, RPCs, cron) | Supabase | SQL Editor (manual), veja [database.md](database.md#bootstrap-de-um-ambiente-novo) |
| Edge Functions | Supabase | `supabase functions deploy <nome>` |
| Secrets das funções | Supabase | `supabase secrets set` |
| Mobile | EAS Build / App Store | `eas build` + `eas submit` (veja [mobile.md](mobile.md#build-e-distribuição-eas)) |

> Não há CI/CD no repositório (não existe `.github/workflows`). **Precisa de validação manual:** se o EasyPanel faz build automático a cada push na `main`, ou se o deploy é disparado manualmente.

## Web: Docker + Nginx

### Dockerfile (multi-stage)

1. **builder** (`node:20-alpine`): recebe `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_ADS_USE_MOCK` (default `false`) como `ARG`/`ENV`. Copia primeiro os manifests (raiz, `apps/web`, `packages/core`) para aproveitar o cache, depois roda `npm ci` e `npm run build`.
2. **runner** (`nginx:1.27-alpine`): copia `nginx.conf` e `apps/web/dist`, e expõe a porta **80**.

### nginx.conf

- Fallback de SPA: `try_files $uri $uri/ /index.html`.
- Assets estáticos com `Cache-Control: public, immutable` e `expires 1y` (os nomes têm hash do Vite).
- gzip para texto, JS, CSS, JSON e SVG.

### Build local

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://<project-ref>.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=<anon-key> \
  -t kairon-web .
docker run --rm -p 8080:80 kairon-web     # http://localhost:8080
```

### EasyPanel

1. App do tipo Dockerfile apontando para este repositório e para o branch `main`.
2. **Build args:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (e `VITE_ADS_USE_MOCK`, se quiser mock).
3. Porta exposta: **80**. Domínio e HTTPS são configurados no próprio EasyPanel.

> **Variáveis `VITE_*` são resolvidas no build.** Alterar uma delas exige rebuild. O `Dockerfile` **não declara** `ARG` para `VITE_SITE_URL` nem para `VITE_RECEITA_POR_CONVERSAO`, então em produção esses valores caem nos fallbacks (`window.location.origin` e `80`). Para customizá-los, adicione os `ARG`/`ENV` correspondentes.

## Edge Functions

```bash
supabase login
supabase link --project-ref <project-ref>

# secrets (uma vez por ambiente; os valores ficam fora do repositório)
supabase secrets set ANTHROPIC_API_KEY=... GOOGLE_CALENDAR_CLIENT_ID=... GOOGLE_CALENDAR_CLIENT_SECRET=...
supabase secrets set META_ACCESS_TOKEN=... META_AD_ACCOUNT_ID=...
supabase secrets set SITE_URL=https://<dominio-do-dashboard>

# deploy
supabase functions deploy invite-user
supabase functions deploy cancel-invite
supabase functions deploy manage-user
supabase functions deploy google-calendar-oauth     # verify_jwt=false via config.toml
supabase functions deploy google-calendar-sync
supabase functions deploy meta-ads
supabase functions deploy google-ads
supabase functions deploy generate-report
supabase functions deploy push-fanout
```

As funções importam `@supabase/supabase-js@2.39.7` via `esm.sh`, sem `deno.json` nem import map.

## Configuração do Supabase (uma vez por ambiente)

- **Auth → URL Configuration:** Site URL igual ao domínio do dashboard. Redirect URLs com `<dominio>`, `<dominio>/aceitar-convite` e `http://localhost:5173/**` (dev).
- **Auth → Providers:** revise o signup público e os providers Google/Apple ([security.md](security.md#2-cadastro-aberto-e-papel-padrão-sdr)).
- **Database → Extensions:** `pg_cron` e `pg_net`.
- **Storage:** os buckets são criados pelas migrations (`client-files`, `member-files`).

## Checklist de pré-deploy

**Código**
- [ ] `npm test -w apps/web` passa
- [ ] `npm run build` passa sem erros
- [ ] Nenhum `.env` real, token ou chave `service_role` no diff (`git diff --cached`)

**Banco**
- [ ] Migrations novas são idempotentes e já foram testadas em um projeto de dev
- [ ] Toda tabela nova tem RLS e policies
- [ ] A ordem de aplicação está documentada (migration antes do deploy do front que depende dela)
- [ ] Backup ou ponto de restauração conferido antes de migrations destrutivas ou de dados

**Edge Functions**
- [ ] Secrets novos definidos no ambiente de destino
- [ ] Funções alteradas foram redeployadas
- [ ] `verify_jwt` correto em `config.toml`

**Web**
- [ ] Build args `VITE_*` corretos no EasyPanel (mock de anúncios desligado em produção)
- [ ] Após o deploy: login, navegação por papel, uma consulta de cada módulo crítico (Comercial, Financeiro) e as notificações

**Mobile**
- [ ] Versão e build number conferidos (`autoIncrement` em `production`)
- [ ] Push testado em dispositivo físico

## Rollback

- **Web:** fazer redeploy da imagem ou do commit anterior no EasyPanel.
- **Edge Functions:** fazer checkout do commit anterior e rodar `supabase functions deploy <nome>` de novo.
- **Banco:** as migrations não têm script de *down*. Reverta com uma nova migration compensatória, ou use o backup ou PITR do Supabase, conforme o plano contratado (**precisa de validação manual**).
