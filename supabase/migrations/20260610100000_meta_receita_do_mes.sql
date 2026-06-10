-- ==================================================================
-- METAS — "Feito da meta" = Receita do mês (MRR ativo + TCV ativo do mês) +
--   vendas avulsas (sem contrato). Assim, ao entrar um TCV no mês, ele entra
--   na meta do mês vigente; e contratos cancelados/encerrados deixam de contar
--   (a função só soma contratos ATIVOS).
--
--  - public.tcv_mes_ativo(): soma do TCV (pontual) dos contratos ATIVOS cujo
--    início cai no mês corrente, de clientes não-churn. SECURITY DEFINER para
--    closer/TV verem o número sem acesso a contratos/clientes.
--  - o gatilho de "meta batida" passa a comparar a Receita do mês + avulsas.
--  Idempotente.
-- ==================================================================

-- TCV ativo do mês corrente (mesmo critério do "TCV do mês" no Financeiro).
CREATE OR REPLACE FUNCTION public.tcv_mes_ativo()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(SUM(ct.valor), 0)
    FROM public.contratos ct
    JOIN public.clientes cl ON cl.id = ct.cliente_id
   WHERE ct.tipo = 'TCV'
     AND ct.status = 'ativo'
     AND cl.status <> 'churn'
     AND date_trunc('month', ct.data_inicio)::date
       = date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date;
$$;

GRANT EXECUTE ON FUNCTION public.tcv_mes_ativo() TO authenticated;

-- Gatilho de meta batida: total do mês = Receita do mês (MRR + TCV ativos) +
-- vendas avulsas (sem contrato). Contratos já estão refletidos em mrr/tcv, então
-- a venda gerada por um contrato não é somada de novo (só contam as avulsas aqui).
CREATE OR REPLACE FUNCTION private.notify_meta_atingida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_comp          date := date_trunc('month', NEW.data_venda)::date;
  v_meta          numeric;
  v_avulsas       numeric;
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

  SELECT COALESCE(SUM(valor), 0) INTO v_avulsas
    FROM public.vendas
   WHERE date_trunc('month', data_venda)::date = v_comp
     AND contrato_id IS NULL;

  v_total_depois := public.mrr_base_ativo() + public.tcv_mes_ativo() + v_avulsas;
  -- A venda recém-inserida (de contrato ou avulsa) contribuiu com NEW.valor.
  v_total_antes := v_total_depois - COALESCE(NEW.valor, 0);

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
