-- ==================================================================
-- METAS — "Feito da meta" = receita recorrente (MRR ativo) + vendas novas.
--  O total do mês passa a considerar a base de MRR já garantida + as vendas
--  do mês, SEM duplicar: um contrato MRR já entra na base (mrr_base_ativo),
--  então a venda gerada por esse contrato não soma de novo. O que soma por
--  cima é o que é genuinamente novo (TCV, vendas avulsas, MRR manual sem
--  contrato).
--
--  total_do_mes = mrr_base_ativo()
--               + SUM(vendas do mês WHERE NOT (tipo = 'MRR' AND contrato_id IS NOT NULL))
--
--  Mantém o gatilho de notificação de "meta batida" coerente com a tela.
--  Idempotente.
-- ==================================================================

CREATE OR REPLACE FUNCTION private.notify_meta_atingida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_comp          date := date_trunc('month', NEW.data_venda)::date;
  v_meta          numeric;
  v_base          numeric;
  v_total_depois  numeric;
  v_total_antes   numeric;
  v_new_conta     boolean;
BEGIN
  SELECT valor_meta INTO v_meta
    FROM public.metas
   WHERE usuario_id IS NULL
     AND competencia = v_comp;

  IF v_meta IS NULL THEN
    RETURN NEW;  -- sem meta global definida para o mês
  END IF;

  v_base := public.mrr_base_ativo();

  -- Soma das vendas do mês que NÃO duplicam a base de MRR (contrato MRR já
  -- está representado em mrr_base_ativo).
  SELECT v_base + COALESCE(SUM(valor), 0) INTO v_total_depois
    FROM public.vendas
   WHERE date_trunc('month', data_venda)::date = v_comp
     AND NOT (tipo = 'MRR' AND contrato_id IS NOT NULL);

  -- A venda recém-inserida só "moveu" o total se ela conta (não é MRR de contrato).
  v_new_conta := NOT (NEW.tipo = 'MRR' AND NEW.contrato_id IS NOT NULL);
  v_total_antes := v_total_depois - (CASE WHEN v_new_conta THEN COALESCE(NEW.valor, 0) ELSE 0 END);

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

-- (trigger vendas_notify_meta já existe das migrations anteriores)
