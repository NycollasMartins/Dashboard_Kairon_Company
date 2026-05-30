-- ==================================================================
-- CAMPANHAS (Meta Ads + Google Ads)
-- Migration idempotente — pode ser reaplicada com segurança.
--
-- Aplicar com:
--   supabase db push                       (CLI, projeto linkado)
-- ou colar o conteúdo no SQL Editor do painel Supabase.
--
-- Padrões seguidos (iguais ao schema.sql existente):
--   - PK uuid DEFAULT gen_random_uuid()
--   - created_at/updated_at timestamptz DEFAULT now()
--   - trigger public.touch_updated_at() para updated_at
--   - RLS habilitada: admin gerencia tudo (private.is_admin());
--     head é somente-leitura (private.is_admin_or_head() no SELECT)
-- ==================================================================

-- ------------------------------------------------------------------
-- TABELA: campaigns
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  platform     text NOT NULL CHECK (platform IN ('meta', 'google')),
  objective    text,
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'paused', 'ended')),
  budget       numeric(12,2),
  budget_type  text NOT NULL DEFAULT 'daily'
                 CHECK (budget_type IN ('daily', 'lifetime')),
  start_date   date,
  end_date     date,
  external_id  text,                 -- id da campanha na plataforma (Meta/Google)
  account_id   text,                 -- id da conta de anúncios na plataforma
  audience     jsonb NOT NULL DEFAULT '{}'::jsonb,  -- segmentação básica
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_platform ON public.campaigns (platform);
CREATE INDEX IF NOT EXISTS idx_campaigns_status   ON public.campaigns (status);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- TABELA: campaign_metrics (histórico diário por campanha)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_metrics (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  date         date NOT NULL,
  spend        numeric(12,2) NOT NULL DEFAULT 0,
  impressions  bigint        NOT NULL DEFAULT 0,
  clicks       bigint        NOT NULL DEFAULT 0,
  ctr          numeric(6,3)  NOT NULL DEFAULT 0,   -- %
  cpc          numeric(12,2) NOT NULL DEFAULT 0,
  conversions  bigint        NOT NULL DEFAULT 0,
  cpa          numeric(12,2) NOT NULL DEFAULT 0,
  roas         numeric(8,2)  NOT NULL DEFAULT 0,
  reach        bigint        NOT NULL DEFAULT 0,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT campaign_metrics_unique_day UNIQUE (campaign_id, date)
);

CREATE INDEX IF NOT EXISTS idx_campaign_metrics_campaign ON public.campaign_metrics (campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_metrics_date     ON public.campaign_metrics (date);

ALTER TABLE public.campaign_metrics ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- Trigger de updated_at (reaproveita a função genérica do schema)
-- ------------------------------------------------------------------
DROP TRIGGER IF EXISTS campaigns_touch_updated_at ON public.campaigns;
CREATE TRIGGER campaigns_touch_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------------
-- RLS — admin gerencia (ALL); head é somente-leitura (SELECT).
--   leitura  -> private.is_admin_or_head()  (admin + head)
--   gestão   -> private.is_admin()          (apenas admin)
-- ------------------------------------------------------------------

-- campaigns ---------------------------------------------------------
DROP POLICY IF EXISTS "campaigns: admin/head read"   ON public.campaigns;
DROP POLICY IF EXISTS "campaigns: admin/head manage" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns: admin manage"      ON public.campaigns;

CREATE POLICY "campaigns: admin/head read"
  ON public.campaigns FOR SELECT
  USING (private.is_admin_or_head());

CREATE POLICY "campaigns: admin manage"
  ON public.campaigns FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

-- campaign_metrics --------------------------------------------------
DROP POLICY IF EXISTS "campaign_metrics: admin/head read"   ON public.campaign_metrics;
DROP POLICY IF EXISTS "campaign_metrics: admin/head manage" ON public.campaign_metrics;
DROP POLICY IF EXISTS "campaign_metrics: admin manage"      ON public.campaign_metrics;

CREATE POLICY "campaign_metrics: admin/head read"
  ON public.campaign_metrics FOR SELECT
  USING (private.is_admin_or_head());

CREATE POLICY "campaign_metrics: admin manage"
  ON public.campaign_metrics FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());
