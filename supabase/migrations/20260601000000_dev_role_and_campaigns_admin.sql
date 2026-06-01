-- ==================================================================
-- Papel 'Dev' + Campanhas restritas a ADMIN
--
-- Regras:
--   - Campanhas (campaigns/campaign_metrics): SOMENTE admin vê e edita.
--   - Novo papel 'dev': acesso tipo-admin a TUDO, EXCETO Campanhas e
--     EXCETO gestão de perfis/papéis (Administrativo) — assim o Dev
--     não consegue se auto-promover a admin para burlar Campanhas.
--
-- Estratégia: os helpers genéricos passam a incluir 'dev'; as duas
-- exceções (perfis e campanhas) usam private.is_strict_admin() (só admin).
-- Idempotente — pode ser reaplicada com segurança.
-- ==================================================================

-- 1) Permite o papel 'dev' no CHECK da coluna role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'social media', 'closer', 'sdr', 'bdr', 'head', 'editor', 'dev'));

-- 2) Check ESTRITO de admin (NÃO inclui dev) — usado nas exceções
CREATE OR REPLACE FUNCTION private.is_strict_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- 3) Helpers genéricos ampliados para incluir 'dev'
CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'dev')
  )
$$;

CREATE OR REPLACE FUNCTION private.is_admin_or_head()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'head', 'dev')
  )
$$;

CREATE OR REPLACE FUNCTION private.is_admin_or_closer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'closer', 'head', 'dev')
  )
$$;

-- 4) EXCEÇÃO 1 — gestão de perfis/papéis continua SÓ admin.
--    (Sem isso, o dev — que tem is_admin()=true — poderia editar papéis.)
DROP POLICY IF EXISTS "profiles: admin update" ON public.profiles;
CREATE POLICY "profiles: admin update"
  ON public.profiles FOR UPDATE
  USING (private.is_strict_admin());

-- 5) EXCEÇÃO 2 — Campanhas SOMENTE admin (remove head e dev).
DROP POLICY IF EXISTS "campaigns: admin/head read"   ON public.campaigns;
DROP POLICY IF EXISTS "campaigns: admin manage"      ON public.campaigns;
DROP POLICY IF EXISTS "campaigns: admin only read"   ON public.campaigns;
DROP POLICY IF EXISTS "campaigns: admin only manage" ON public.campaigns;

CREATE POLICY "campaigns: admin only read"
  ON public.campaigns FOR SELECT
  USING (private.is_strict_admin());

CREATE POLICY "campaigns: admin only manage"
  ON public.campaigns FOR ALL
  USING (private.is_strict_admin())
  WITH CHECK (private.is_strict_admin());

DROP POLICY IF EXISTS "campaign_metrics: admin/head read"   ON public.campaign_metrics;
DROP POLICY IF EXISTS "campaign_metrics: admin manage"      ON public.campaign_metrics;
DROP POLICY IF EXISTS "campaign_metrics: admin only read"   ON public.campaign_metrics;
DROP POLICY IF EXISTS "campaign_metrics: admin only manage" ON public.campaign_metrics;

CREATE POLICY "campaign_metrics: admin only read"
  ON public.campaign_metrics FOR SELECT
  USING (private.is_strict_admin());

CREATE POLICY "campaign_metrics: admin only manage"
  ON public.campaign_metrics FOR ALL
  USING (private.is_strict_admin())
  WITH CHECK (private.is_strict_admin());
