-- ==================================================================
-- METAS — ajustes:
--  1) Papel "tv": acesso somente-leitura à aba Metas (painel/TV).
--  2) vendas.closer_id passa a aceitar NULL => "venda direta" (cliente que
--     fecha sem passar por closer). Entra no "feito da meta", fora do ranking.
--  3) Notificação de meta batida ganha metadata.evento = 'meta_batida' para o
--     front disparar o popup de comemoração (todos do dash) + supermeta.
--  Idempotente.
-- ==================================================================

-- 1) Papel "tv"
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'social media', 'closer', 'sdr', 'bdr', 'head', 'editor', 'dev', 'tv'));

-- 2) Venda direta (sem closer)
ALTER TABLE public.vendas ALTER COLUMN closer_id DROP NOT NULL;

-- 3) Notificação de meta batida (+ marcador para o popup global)
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
           'A meta de R$ ' || to_char(v_meta, 'FM999999990D00')
             || ' foi atingida! Agora começa a SUPERMETA: toda venda acima da meta vale comissão dobrada (2×).',
           '/metas',
           jsonb_build_object('competencia', v_comp, 'evento', 'meta_batida')
      FROM public.profiles p
     WHERE p.archived_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- (trigger vendas_notify_meta já existe da migration anterior)
