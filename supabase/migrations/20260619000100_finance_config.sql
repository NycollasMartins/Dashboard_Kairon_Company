-- ==================================================================
-- FINANCE_CONFIG — configuração financeira global (linha única).
--
-- Hoje guarda o SALDO INICIAL de caixa (e a data de referência), para a aba
-- Financeiro exibir o saldo de caixa ABSOLUTO:
--   saldo = saldo_inicial + Σ(entradas − saídas) a partir de saldo_inicial_data
-- Entradas = parcelas pagas (contrato_parcelas.pago_em).
-- Saídas    = custos operacionais (por competência) + gasto em ads (por data).
--
-- Acesso: estrito admin (mesmo nível da aba Financeiro). Idempotente.
-- ==================================================================

CREATE TABLE IF NOT EXISTS public.finance_config (
  id                 smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- linha única
  saldo_inicial      numeric(12, 2) NOT NULL DEFAULT 0,
  saldo_inicial_data date NOT NULL DEFAULT CURRENT_DATE,
  updated_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Semente da linha única (não sobrescreve se já existir).
INSERT INTO public.finance_config (id, saldo_inicial, saldo_inicial_data)
VALUES (1, 0, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.finance_config ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS finance_config_touch_updated_at ON public.finance_config;
CREATE TRIGGER finance_config_touch_updated_at
  BEFORE UPDATE ON public.finance_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS — estrito admin lê e atualiza (sem insert/delete: a linha já existe).
DROP POLICY IF EXISTS "finance_config: admin read"   ON public.finance_config;
DROP POLICY IF EXISTS "finance_config: admin update" ON public.finance_config;
CREATE POLICY "finance_config: admin read"
  ON public.finance_config FOR SELECT
  USING (private.is_strict_admin());
CREATE POLICY "finance_config: admin update"
  ON public.finance_config FOR UPDATE
  USING (private.is_strict_admin())
  WITH CHECK (private.is_strict_admin());

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'finance_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.finance_config;
  END IF;
END $$;

-- ==================================================================
-- ROLLBACK: DROP TABLE IF EXISTS public.finance_config CASCADE;
-- ==================================================================
