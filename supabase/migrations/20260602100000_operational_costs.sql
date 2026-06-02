-- ==================================================================
-- CUSTOS OPERACIONAIS (aba Financeiro) — somente admin.
-- Registra despesas operacionais da agência (recorrentes ou pontuais)
-- por mês de competência. Alimenta o cálculo de ROI/margem.
-- Idempotente.
-- ==================================================================

CREATE TABLE IF NOT EXISTS public.operational_costs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description  text NOT NULL,
  category     text NOT NULL DEFAULT 'outros'
                 CHECK (category IN ('salarios', 'ferramentas', 'infraestrutura', 'impostos', 'marketing', 'outros')),
  amount       numeric(12, 2) NOT NULL,
  competencia  date NOT NULL,              -- mês de competência (use o dia 1)
  recurring    boolean NOT NULL DEFAULT false,  -- recorre todo mês a partir da competência
  notes        text,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_costs_competencia ON public.operational_costs (competencia);

ALTER TABLE public.operational_costs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS operational_costs_touch_updated_at ON public.operational_costs;
CREATE TRIGGER operational_costs_touch_updated_at
  BEFORE UPDATE ON public.operational_costs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS — somente admin (estrito, exclui dev/head), igual ao acesso da aba Financeiro.
DROP POLICY IF EXISTS "operational_costs: admin read"   ON public.operational_costs;
DROP POLICY IF EXISTS "operational_costs: admin manage" ON public.operational_costs;
CREATE POLICY "operational_costs: admin read"
  ON public.operational_costs FOR SELECT
  USING (private.is_strict_admin());
CREATE POLICY "operational_costs: admin manage"
  ON public.operational_costs FOR ALL
  USING (private.is_strict_admin())
  WITH CHECK (private.is_strict_admin());

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'operational_costs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.operational_costs;
  END IF;
END $$;
