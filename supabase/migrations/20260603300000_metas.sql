-- ==================================================================
-- METAS DE VENDAS (aba Metas)
--  - metas: meta do mês (global) + meta individual por closer (em R$)
--      * usuario_id NULL  => meta GLOBAL do mês
--      * usuario_id setado => meta INDIVIDUAL daquele closer
--  - vendas: cada venda lançada por um closer (ou pelo admin em nome dele)
--  - Ranking "quem vendeu / quanto vendeu" = soma das vendas do mês por closer
--  - Ao bater a meta GLOBAL do mês => notifica TODOS os usuários do dash
--  Visível a todos (SELECT liberado); gestão de metas só admin; lançar venda
--  só admin/closer. Idempotente.
-- ==================================================================

-- ------------------------------------------------------------------
-- METAS (meta do mês global + metas individuais por closer)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.metas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia  date NOT NULL,                 -- mês de competência (use o dia 1)
  usuario_id   uuid REFERENCES public.profiles(id) ON DELETE CASCADE,  -- NULL = meta global
  valor_meta   numeric(12, 2) NOT NULL CHECK (valor_meta > 0),
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Uma única meta GLOBAL por mês (usuario_id NULL) ...
CREATE UNIQUE INDEX IF NOT EXISTS idx_metas_global_unica
  ON public.metas (competencia) WHERE usuario_id IS NULL;
-- ... e uma única meta INDIVIDUAL por (closer, mês).
CREATE UNIQUE INDEX IF NOT EXISTS idx_metas_individual_unica
  ON public.metas (competencia, usuario_id) WHERE usuario_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_metas_competencia ON public.metas (competencia);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS metas_touch_updated_at ON public.metas;
CREATE TRIGGER metas_touch_updated_at
  BEFORE UPDATE ON public.metas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS: todos os autenticados leem (todos veem a meta do mês); só admin gerencia.
DROP POLICY IF EXISTS "metas: authenticated read" ON public.metas;
DROP POLICY IF EXISTS "metas: admin manage"       ON public.metas;
CREATE POLICY "metas: authenticated read"
  ON public.metas FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "metas: admin manage"
  ON public.metas FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

-- ------------------------------------------------------------------
-- VENDAS (cada venda atribuída a um closer)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closer_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,  -- quem vendeu
  valor        numeric(12, 2) NOT NULL CHECK (valor > 0),
  cliente_nome text,                          -- cliente / descrição da venda (opcional)
  data_venda   date NOT NULL DEFAULT current_date,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendas_closer ON public.vendas (closer_id);
CREATE INDEX IF NOT EXISTS idx_vendas_data   ON public.vendas (data_venda);

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

-- RLS: todos leem (ranking visível a todos); admin/closer lançam; quem lançou
-- (ou admin) pode editar/remover.
DROP POLICY IF EXISTS "vendas: authenticated read" ON public.vendas;
DROP POLICY IF EXISTS "vendas: closer insert"      ON public.vendas;
DROP POLICY IF EXISTS "vendas: owner or admin mod" ON public.vendas;
CREATE POLICY "vendas: authenticated read"
  ON public.vendas FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "vendas: closer insert"
  ON public.vendas FOR INSERT
  WITH CHECK (private.is_admin_or_closer());
CREATE POLICY "vendas: owner or admin update"
  ON public.vendas FOR UPDATE
  USING (private.is_admin() OR created_by = auth.uid())
  WITH CHECK (private.is_admin() OR created_by = auth.uid());
CREATE POLICY "vendas: owner or admin delete"
  ON public.vendas FOR DELETE
  USING (private.is_admin() OR created_by = auth.uid());

-- ------------------------------------------------------------------
-- Notifica TODOS quando a meta GLOBAL do mês é batida (no insert que cruza).
-- Dispara só na venda que faz o total do mês cruzar a meta (antes < meta <= depois).
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_meta_atingida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_comp          date := date_trunc('month', NEW.data_venda)::date;
  v_meta          numeric;
  v_total_depois  numeric;
  v_total_antes   numeric;
BEGIN
  SELECT valor_meta INTO v_meta
    FROM public.metas
   WHERE usuario_id IS NULL
     AND competencia = v_comp;

  IF v_meta IS NULL THEN
    RETURN NEW;  -- sem meta global definida para o mês
  END IF;

  SELECT COALESCE(SUM(valor), 0) INTO v_total_depois
    FROM public.vendas
   WHERE date_trunc('month', data_venda)::date = v_comp;

  v_total_antes := v_total_depois - NEW.valor;

  IF v_total_antes < v_meta AND v_total_depois >= v_meta THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    SELECT p.id,
           'meta',
           'Meta do mês batida! 🎉',
           'A meta de R$ ' || to_char(v_meta, 'FM999999990D00') || ' foi atingida. Parabéns ao time!',
           '/metas',
           jsonb_build_object('competencia', v_comp)
      FROM public.profiles p
     WHERE p.archived_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendas_notify_meta ON public.vendas;
CREATE TRIGGER vendas_notify_meta
  AFTER INSERT ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION private.notify_meta_atingida();

-- ------------------------------------------------------------------
-- Realtime (ranking e progresso ao vivo)
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'metas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.metas;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'vendas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vendas;
  END IF;
END $$;
