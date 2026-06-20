-- ==================================================================
-- CONTRATO_PARCELAS — cronograma de recebíveis por contrato.
--
-- Cada contrato gera parcelas (linhas de cobrança):
--   MRR -> 1 parcela por mês na vigência [data_inicio .. fim efetivo]
--   TCV -> 1 parcela única no início (100% no fechamento — à vista)
--
-- Habilita: contas a receber, inadimplência REAL e caixa REAL.
-- IMPORTANTE: inadimplência/caixa só ficam corretos se o pagamento for
-- registrado (pago_em). Hoje o registro é MANUAL (botão "marcar como pago"
-- na tela de Recebíveis); a tabela já está pronta para um gateway no futuro
-- (origem_pagamento='gateway', referencia_externa, gateway_id, metodo_pagamento).
--
-- Acesso: estrito admin (mesmo nível da aba Financeiro / operational_costs).
-- Idempotente. Rollback ao final do arquivo (comentado).
-- ==================================================================

-- ------------------------------------------------------------------
-- Tabela
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contrato_parcelas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id       uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  cliente_id        uuid NOT NULL REFERENCES public.clientes(id)  ON DELETE CASCADE,
  competencia       date NOT NULL,                         -- mês de referência (dia 1)
  valor             numeric(12, 2) NOT NULL CHECK (valor > 0),
  vencimento        date NOT NULL,                         -- data de vencimento da parcela
  pago_em           date,                                  -- NULL = não pago; data = quando pagou
  -- Status comporta estados de gateway. 'vencido' pode ser gravado por um
  -- gateway; na aplicação, o "vencido" exibido é derivado (em_aberto + vencimento < hoje),
  -- então não dependemos de job para virar o status.
  status            text NOT NULL DEFAULT 'em_aberto'
                      CHECK (status IN ('em_aberto', 'pago', 'vencido', 'falhou', 'estornado')),
  -- Como o pagamento foi registrado (não assumir 'manual' fixo).
  origem_pagamento  text CHECK (origem_pagamento IN ('manual', 'backfill', 'gateway')),
  metodo_pagamento  text,                                  -- pix, boleto, cartao, ... (livre)
  gateway_id        text,                                  -- id da transação no gateway
  referencia_externa text,                                 -- referência externa (NSU, etc.)
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- 1 parcela por contrato+competência (evita duplicar na regeneração).
CREATE UNIQUE INDEX IF NOT EXISTS idx_contrato_parcelas_contrato_comp
  ON public.contrato_parcelas (contrato_id, competencia);
CREATE INDEX IF NOT EXISTS idx_contrato_parcelas_cliente
  ON public.contrato_parcelas (cliente_id);
CREATE INDEX IF NOT EXISTS idx_contrato_parcelas_competencia
  ON public.contrato_parcelas (competencia);
-- Recebíveis em aberto (contas a receber / inadimplência): só as não pagas.
CREATE INDEX IF NOT EXISTS idx_contrato_parcelas_abertas
  ON public.contrato_parcelas (vencimento)
  WHERE pago_em IS NULL;

ALTER TABLE public.contrato_parcelas ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS contrato_parcelas_touch_updated_at ON public.contrato_parcelas;
CREATE TRIGGER contrato_parcelas_touch_updated_at
  BEFORE UPDATE ON public.contrato_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS — estrito admin (mesmo acesso da aba Financeiro).
DROP POLICY IF EXISTS "contrato_parcelas: admin read"   ON public.contrato_parcelas;
DROP POLICY IF EXISTS "contrato_parcelas: admin manage" ON public.contrato_parcelas;
CREATE POLICY "contrato_parcelas: admin read"
  ON public.contrato_parcelas FOR SELECT
  USING (private.is_strict_admin());
CREATE POLICY "contrato_parcelas: admin manage"
  ON public.contrato_parcelas FOR ALL
  USING (private.is_strict_admin())
  WITH CHECK (private.is_strict_admin());

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'contrato_parcelas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contrato_parcelas;
  END IF;
END $$;

-- ------------------------------------------------------------------
-- RPC: gerar (ou regenerar) as parcelas de um contrato.
--
-- Princípio: o cronograma reflete a REALIDADE de cada contrato.
--   • Contrato ATIVO  -> cronograma completo da vigência.
--       MRR: 1 parcela/mês em [data_inicio .. data_fim].
--       TCV: 1 parcela no início (à vista, 100% no fechamento).
--       No backfill, parcela vencida (vencimento < hoje) entra como PAGA;
--       as futuras ficam 'em_aberto' (pagamento registrado depois).
--   • Contrato ENCERRADO (cancelado/expirado/renovado) -> NÃO tem parcela
--       futura em aberto. No backfill histórico, as parcelas PAGAS são
--       reconstruídas a partir de `total_recebido` (a verdade de caixa que o
--       resto do app já usa em tcvHistorico/LTV/expire). Assim o caixa do
--       Financeiro reconcilia exatamente e NÃO inventa receita:
--         MRR: nº de parcelas pagas = round(total_recebido / valor)
--         TCV: 1 parcela paga = total_recebido (cobre recebimento parcial)
--       total_recebido = 0 (churn antes de pagar) -> nenhuma parcela.
--
-- p_backfill_passado=true  -> usado só no backfill (marca histórico como pago).
-- p_backfill_passado=false -> fluxo ao vivo (criar/cancelar): parcelas de
--   contrato ativo nascem 'em_aberto'; ao cancelar, as abertas futuras são
--   removidas e as pagas reais preservadas.
--
-- Idempotente: remove só as parcelas 'em_aberto' (preserva pagas/estornadas).
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.gerar_parcelas_contrato(
  p_contrato_id      uuid,
  p_backfill_passado boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_ct       public.contratos%ROWTYPE;
  v_fechado  boolean;
  v_n        integer := 0;
  m          integer;
  v_npagas   integer;
  v_comp     date;
  v_venc     date;
  v_passou   boolean;
BEGIN
  SELECT * INTO v_ct FROM public.contratos WHERE id = p_contrato_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato % não encontrado.', p_contrato_id USING ERRCODE = 'P0002';
  END IF;

  -- Remove só as parcelas EM ABERTO (preserva pagas/estornadas).
  DELETE FROM public.contrato_parcelas
    WHERE contrato_id = p_contrato_id
      AND pago_em IS NULL
      AND status = 'em_aberto';

  v_fechado := v_ct.status IN ('cancelado', 'expirado', 'renovado');

  IF v_fechado THEN
    -- Encerrado: sem parcela futura. No backfill, reconstrói as pagas a
    -- partir de total_recebido (reconcilia caixa; não cria abertas).
    IF p_backfill_passado THEN
      IF v_ct.tipo = 'TCV' THEN
        IF COALESCE(v_ct.total_recebido, 0) > 0 THEN
          v_comp := date_trunc('month', v_ct.data_inicio)::date;
          INSERT INTO public.contrato_parcelas (
            contrato_id, cliente_id, competencia, valor, vencimento, pago_em, status, origem_pagamento
          ) VALUES (
            p_contrato_id, v_ct.cliente_id, v_comp, v_ct.total_recebido, v_ct.data_inicio,
            v_ct.data_inicio, 'pago', 'backfill'
          )
          ON CONFLICT (contrato_id, competencia) DO NOTHING;
          v_n := 1;
        END IF;
      ELSE
        -- MRR encerrado: nº de meses pagos = total_recebido / valor.
        v_npagas := LEAST(v_ct.duracao_meses,
                          GREATEST(0, round(COALESCE(v_ct.total_recebido, 0) / v_ct.valor)::int));
        FOR m IN 0 .. (v_npagas - 1) LOOP
          v_venc := (v_ct.data_inicio + (m || ' months')::interval)::date;
          v_comp := date_trunc('month', v_venc)::date;
          INSERT INTO public.contrato_parcelas (
            contrato_id, cliente_id, competencia, valor, vencimento, pago_em, status, origem_pagamento
          ) VALUES (
            p_contrato_id, v_ct.cliente_id, v_comp, v_ct.valor, v_venc,
            v_venc, 'pago', 'backfill'
          )
          ON CONFLICT (contrato_id, competencia) DO NOTHING;
          v_n := v_n + 1;
        END LOOP;
      END IF;
    END IF;
    -- ao vivo (cancel): nada a criar — abertas já removidas, pagas preservadas.
  ELSE
    -- ATIVO: cronograma completo da vigência.
    IF v_ct.tipo = 'TCV' THEN
      v_comp   := date_trunc('month', v_ct.data_inicio)::date;
      v_venc   := v_ct.data_inicio;
      v_passou := p_backfill_passado AND v_venc < CURRENT_DATE;
      INSERT INTO public.contrato_parcelas (
        contrato_id, cliente_id, competencia, valor, vencimento, pago_em, status, origem_pagamento
      ) VALUES (
        p_contrato_id, v_ct.cliente_id, v_comp, v_ct.valor, v_venc,
        CASE WHEN v_passou THEN v_venc ELSE NULL END,
        CASE WHEN v_passou THEN 'pago' ELSE 'em_aberto' END,
        CASE WHEN v_passou THEN 'backfill' ELSE NULL END
      )
      ON CONFLICT (contrato_id, competencia) DO NOTHING;
      v_n := 1;
    ELSE
      FOR m IN 0 .. (v_ct.duracao_meses - 1) LOOP
        v_venc   := (v_ct.data_inicio + (m || ' months')::interval)::date;
        v_comp   := date_trunc('month', v_venc)::date;
        v_passou := p_backfill_passado AND v_venc < CURRENT_DATE;
        INSERT INTO public.contrato_parcelas (
          contrato_id, cliente_id, competencia, valor, vencimento, pago_em, status, origem_pagamento
        ) VALUES (
          p_contrato_id, v_ct.cliente_id, v_comp, v_ct.valor, v_venc,
          CASE WHEN v_passou THEN v_venc ELSE NULL END,
          CASE WHEN v_passou THEN 'pago' ELSE 'em_aberto' END,
          CASE WHEN v_passou THEN 'backfill' ELSE NULL END
        )
        ON CONFLICT (contrato_id, competencia) DO NOTHING;
        v_n := v_n + 1;
      END LOOP;
    END IF;
  END IF;

  RETURN v_n;
END;
$$;

REVOKE ALL  ON FUNCTION public.gerar_parcelas_contrato(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gerar_parcelas_contrato(uuid, boolean) TO authenticated;

-- ------------------------------------------------------------------
-- Hook em criar_contrato (versão com closer): gerar parcelas do novo contrato.
-- Mantém o corpo original e só acrescenta a geração de parcelas.
-- ------------------------------------------------------------------
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

  SELECT nome INTO v_cliente_nome FROM public.clientes WHERE id = p_cliente_id;

  INSERT INTO public.vendas (
    closer_id, valor, tipo, cliente_nome, data_venda, contrato_id, created_by
  ) VALUES (
    v_closer_id, p_valor, p_tipo, v_cliente_nome, p_data_inicio, v_id, auth.uid()
  );

  -- NOVO: gera o cronograma de parcelas do contrato (em_aberto; pagamento
  -- registrado depois). Não marca passado como pago no fluxo normal.
  PERFORM public.gerar_parcelas_contrato(v_id, false);

  RETURN v_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.criar_contrato(uuid, text, numeric, integer, date, text[], text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_contrato(uuid, text, numeric, integer, date, text[], text, uuid) TO authenticated;

-- ------------------------------------------------------------------
-- Hook em cancelar_contrato: após cancelar, remover parcelas futuras em
-- aberto (regenerando até o mês do cancelamento). Parcelas já pagas ficam.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_contrato(
  p_contrato_id    uuid,
  p_motivo         text,
  p_total_recebido numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_contrato public.contratos%ROWTYPE;
  v_total    numeric(12, 2);
BEGIN
  IF NOT private.is_admin_or_head() THEN
    RAISE EXCEPTION 'Apenas admin ou head podem cancelar contratos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo do cancelamento é obrigatório.' USING ERRCODE = '22023';
  END IF;

  IF p_total_recebido IS NOT NULL AND p_total_recebido < 0 THEN
    RAISE EXCEPTION 'Total recebido não pode ser negativo.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_contrato FROM public.contratos
    WHERE id = p_contrato_id AND status = 'ativo'
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato % não encontrado ou não está ativo.', p_contrato_id
      USING ERRCODE = 'P0002';
  END IF;

  v_total := COALESCE(p_total_recebido, CASE
    WHEN v_contrato.tipo = 'MRR' THEN
      v_contrato.valor * GREATEST(0, LEAST(
        v_contrato.duracao_meses,
        (EXTRACT(YEAR  FROM age(CURRENT_DATE, v_contrato.data_inicio)) * 12
       + EXTRACT(MONTH FROM age(CURRENT_DATE, v_contrato.data_inicio)))::int
      ))
    ELSE v_contrato.valor
  END);

  UPDATE public.contratos
     SET status = 'cancelado',
         data_cancelamento = CURRENT_DATE,
         motivo_cancelamento = trim(p_motivo),
         total_recebido = v_total,
         updated_at = now()
   WHERE id = p_contrato_id;

  -- NOVO: descarta parcelas futuras em aberto (mantém as já pagas).
  PERFORM public.gerar_parcelas_contrato(p_contrato_id, false);
END;
$$;

REVOKE ALL  ON FUNCTION public.cancelar_contrato(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_contrato(uuid, text, numeric) TO authenticated;

-- ==================================================================
-- ROLLBACK (reversível) — executar para desfazer esta migration:
--   DROP FUNCTION IF EXISTS public.gerar_parcelas_contrato(uuid, boolean);
--   DROP TABLE IF EXISTS public.contrato_parcelas CASCADE;
--   -- e reaplicar a versão anterior de criar_contrato/cancelar_contrato
--   -- (migration 20260603600000 e schema.sql), que não chamam gerar_parcelas.
-- ==================================================================
