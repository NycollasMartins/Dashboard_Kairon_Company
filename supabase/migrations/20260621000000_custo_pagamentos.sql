-- ==================================================================
-- CUSTO_PAGAMENTOS — controle de pagamento dos custos MENSAIS (recorrentes).
--
-- Cada linha = "o custo recorrente X foi pago no mês Y". Alimenta a aba
-- "Contas a Pagar" do Financeiro (salários, plataformas/SaaS, infra, etc.).
-- A fonte dos custos é operational_costs (recurring = true). Aqui só
-- registramos QUANDO/SE cada custo recorrente foi pago, por competência.
--
-- Modelo esparso: não pré-gera linhas. Marcar como pago = INSERT;
-- desmarcar = DELETE. A ausência de linha (custo, mês) = pendente.
--
-- Acesso: estrito admin (mesmo nível da aba Financeiro). Idempotente.
-- ==================================================================

CREATE TABLE IF NOT EXISTS public.custo_pagamentos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custo_id         uuid NOT NULL REFERENCES public.operational_costs(id) ON DELETE CASCADE,
  competencia      date NOT NULL,                       -- mês pago (dia 1)
  valor            numeric(12, 2) NOT NULL CHECK (valor >= 0),
  pago_em          date NOT NULL DEFAULT CURRENT_DATE,  -- data do pagamento
  metodo_pagamento text,
  notas            text,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 1 pagamento por custo+competência (não duplica o mesmo mês).
CREATE UNIQUE INDEX IF NOT EXISTS idx_custo_pagamentos_custo_comp
  ON public.custo_pagamentos (custo_id, competencia);
CREATE INDEX IF NOT EXISTS idx_custo_pagamentos_competencia
  ON public.custo_pagamentos (competencia);

ALTER TABLE public.custo_pagamentos ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS custo_pagamentos_touch_updated_at ON public.custo_pagamentos;
CREATE TRIGGER custo_pagamentos_touch_updated_at
  BEFORE UPDATE ON public.custo_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS — estrito admin (mesmo acesso da aba Financeiro).
DROP POLICY IF EXISTS "custo_pagamentos: admin read"   ON public.custo_pagamentos;
DROP POLICY IF EXISTS "custo_pagamentos: admin manage" ON public.custo_pagamentos;
CREATE POLICY "custo_pagamentos: admin read"
  ON public.custo_pagamentos FOR SELECT
  USING (private.is_strict_admin());
CREATE POLICY "custo_pagamentos: admin manage"
  ON public.custo_pagamentos FOR ALL
  USING (private.is_strict_admin())
  WITH CHECK (private.is_strict_admin());

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'custo_pagamentos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.custo_pagamentos;
  END IF;
END $$;

-- ==================================================================
-- ROLLBACK: DROP TABLE IF EXISTS public.custo_pagamentos CASCADE;
-- ==================================================================
