-- ==================================================================
-- METAS — base de MRR no "Feito da meta".
--  O "Feito da meta" passa a ser:  MRR do mês (contratos MRR ativos) + vendas.
--  Motivo: os contratos MRR foram cadastrados ANTES da aba de Metas existir;
--  daqui pra frente o que entra são as vendas registradas. O MRR é a base já
--  conquistada do mês.
--
--  - public.mrr_base_ativo(): soma do MRR ativo (igual ao "MRR do mês" do
--    Financeiro), exposta a todos os autenticados via SECURITY DEFINER — assim
--    closer/TV veem o número sem ter acesso à tabela de clientes/contratos.
--  - o gatilho de "meta batida" passa a considerar essa base + as vendas.
--  Idempotente.
-- ==================================================================

-- MRR ativo (não-churn) = mesmo critério do "MRR do mês" no Financeiro:
-- soma do valor dos contratos MRR com status 'ativo' de clientes não em churn.
CREATE OR REPLACE FUNCTION public.mrr_base_ativo()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(SUM(ct.valor), 0)
    FROM public.contratos ct
    JOIN public.clientes cl ON cl.id = ct.cliente_id
   WHERE ct.tipo = 'MRR'
     AND ct.status = 'ativo'
     AND cl.status <> 'churn';
$$;

GRANT EXECUTE ON FUNCTION public.mrr_base_ativo() TO authenticated;

-- Gatilho de meta batida: total do mês = MRR base + soma das vendas do mês.
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
BEGIN
  SELECT valor_meta INTO v_meta
    FROM public.metas
   WHERE usuario_id IS NULL
     AND competencia = v_comp;

  IF v_meta IS NULL THEN
    RETURN NEW;  -- sem meta global definida para o mês
  END IF;

  v_base := public.mrr_base_ativo();

  SELECT v_base + COALESCE(SUM(valor), 0) INTO v_total_depois
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
