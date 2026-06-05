-- ==================================================================
-- METAS — contrato gera a venda + conversão de lead por closer.
--  Modelo: cada contrato fechado = UMA venda no mês do fechamento.
--    MRR  -> valor = parcela mensal (p_valor do contrato)
--    TCV  -> valor = total do contrato (p_valor do contrato)
--  A venda é atribuída ao closer que vendeu (p_closer_id); se nulo/não-closer,
--  conta só na meta do mês (sem ranking / sem vendas do mês).
--
--  - vendas ganha: tipo ('MRR'|'TCV') e contrato_id (vínculo 1:1 com o contrato)
--  - criar_contrato(+ p_closer_id) cria o contrato E a venda automaticamente
--  - convert_lead_to_cliente passa a permitir CLOSER (não só admin/head)
--  - gatilho de meta batida: total do mês = soma das vendas (sem base de MRR)
--  Idempotente.
-- ==================================================================

-- ------------------------------------------------------------------
-- vendas: tipo + vínculo com o contrato de origem
-- ------------------------------------------------------------------
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS tipo text;
ALTER TABLE public.vendas DROP CONSTRAINT IF EXISTS vendas_tipo_check;
ALTER TABLE public.vendas ADD CONSTRAINT vendas_tipo_check
  CHECK (tipo IS NULL OR tipo IN ('MRR', 'TCV'));

ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS contrato_id uuid
  REFERENCES public.contratos(id) ON DELETE CASCADE;
-- Um contrato gera no máximo uma venda.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendas_contrato_unico
  ON public.vendas (contrato_id) WHERE contrato_id IS NOT NULL;

-- ------------------------------------------------------------------
-- criar_contrato: + p_closer_id e geração automática da venda
-- ------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.criar_contrato(uuid, text, numeric, integer, date, text[], text);

CREATE OR REPLACE FUNCTION public.criar_contrato(
  p_cliente_id    uuid,
  p_tipo          text,
  p_valor         numeric,
  p_duracao_meses integer,
  p_data_inicio   date,
  p_entregaveis   text[] DEFAULT NULL,
  p_notas         text   DEFAULT NULL,
  p_closer_id     uuid   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_id           uuid;
  v_data_fim     date;
  v_cliente_nome text;
  v_closer_id    uuid := p_closer_id;
BEGIN
  IF NOT private.is_admin_or_head() THEN
    RAISE EXCEPTION 'Apenas admin ou head podem gerenciar contratos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_tipo NOT IN ('MRR', 'TCV') THEN
    RAISE EXCEPTION 'Tipo de contrato inválido: %', p_tipo USING ERRCODE = '22023';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;
  IF p_duracao_meses IS NULL OR p_duracao_meses <= 0 THEN
    RAISE EXCEPTION 'Duração em meses deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;
  IF p_data_inicio IS NULL THEN
    RAISE EXCEPTION 'Data de início é obrigatória.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contratos
    WHERE cliente_id = p_cliente_id
      AND status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'Cliente já possui contrato ativo. Cancele ou expire o contrato atual antes de criar um novo.'
      USING ERRCODE = '23505';
  END IF;

  -- Só credita o ranking se o responsável for de fato um closer; senão a venda
  -- entra "sem responsável" (conta só na meta do mês).
  IF v_closer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_closer_id AND role = 'closer'
  ) THEN
    v_closer_id := NULL;
  END IF;

  v_data_fim := (p_data_inicio + (p_duracao_meses || ' months')::interval)::date - 1;

  INSERT INTO public.contratos (
    cliente_id, tipo, valor, duracao_meses, data_inicio, data_fim,
    entregaveis, notas, status, created_by
  ) VALUES (
    p_cliente_id, p_tipo, p_valor, p_duracao_meses, p_data_inicio, v_data_fim,
    p_entregaveis, NULLIF(TRIM(p_notas), ''), 'ativo', auth.uid()
  )
  RETURNING id INTO v_id;

  -- Venda automática a partir do contrato (MRR = parcela; TCV = total).
  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = p_cliente_id;

  INSERT INTO public.vendas (
    closer_id, valor, tipo, cliente_nome, data_venda, contrato_id, created_by
  ) VALUES (
    v_closer_id, p_valor, p_tipo, v_cliente_nome, p_data_inicio, v_id, auth.uid()
  );

  RETURN v_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.criar_contrato(uuid, text, numeric, integer, date, text[], text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_contrato(uuid, text, numeric, integer, date, text[], text, uuid) TO authenticated;

-- ------------------------------------------------------------------
-- convert_lead_to_cliente: permitir CLOSER (além de admin/head)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_lead_to_cliente(
  p_lead_id        uuid,
  p_squad_id       uuid    DEFAULT NULL,
  p_responsavel_id uuid    DEFAULT NULL,
  p_entregaveis    text[]  DEFAULT NULL,
  p_notas          text    DEFAULT NULL,
  p_nome           text    DEFAULT NULL,
  p_empresa        text    DEFAULT NULL,
  p_email          text    DEFAULT NULL,
  p_telefone       text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_lead       public.leads%ROWTYPE;
  v_cliente_id uuid;
BEGIN
  IF NOT (
    private.is_admin_or_head()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'closer')
  ) THEN
    RAISE EXCEPTION 'Apenas admin, head ou closer podem converter leads em clientes.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % não encontrado.', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  IF v_lead.cliente_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já foi convertido em cliente (cliente_id=%).', v_lead.cliente_id
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.clientes (
    nome, empresa, email, telefone,
    squad_id, responsavel_id, entregaveis, notas, origem, status
  ) VALUES (
    COALESCE(NULLIF(TRIM(p_nome), ''),    v_lead.nome),
    COALESCE(NULLIF(TRIM(p_empresa), ''), v_lead.empresa),
    COALESCE(NULLIF(TRIM(p_email), ''),   v_lead.email),
    COALESCE(NULLIF(TRIM(p_telefone),''), v_lead.telefone),
    p_squad_id,
    p_responsavel_id,
    p_entregaveis,
    COALESCE(NULLIF(TRIM(p_notas), ''), v_lead.notas),
    'lead',
    'ativo'
  )
  RETURNING id INTO v_cliente_id;

  UPDATE public.leads
     SET cliente_id = v_cliente_id,
         updated_at = now()
   WHERE id = p_lead_id;

  RETURN v_cliente_id;
END;
$$;

-- ------------------------------------------------------------------
-- Gatilho de meta batida: total do mês = soma das vendas do mês
-- (sem base de MRR — agora cada contrato vira venda).
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
    RETURN NEW;
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
