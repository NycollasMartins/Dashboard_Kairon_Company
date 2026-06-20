-- ==================================================================
-- BACKFILL de contrato_parcelas (passo de DADOS, separado e reversível).
--
-- Gera o cronograma de parcelas de TODOS os contratos existentes.
-- Regra (p_backfill_passado = true):
--   - parcela com vencimento no PASSADO  -> entra como PAGA
--     (pago_em = vencimento, origem 'backfill')
--   - parcela com vencimento FUTURO       -> entra 'em_aberto'
-- Motivo: nunca registramos pagamento até hoje; marcar histórico como pago
-- evita inadimplência histórica FALSA. A partir de agora o pagamento é
-- registrado manualmente (ou via gateway no futuro).
--
-- Idempotente: gerar_parcelas_contrato preserva parcelas já pagas e só
-- recria as 'em_aberto'. Rodar de novo não duplica.
-- ==================================================================

DO $$
DECLARE
  r record;
  v_total integer := 0;
BEGIN
  FOR r IN SELECT id FROM public.contratos LOOP
    v_total := v_total + public.gerar_parcelas_contrato(r.id, true);
  END LOOP;
  RAISE NOTICE 'Backfill contrato_parcelas: % parcelas processadas.', v_total;
END $$;

-- ==================================================================
-- ROLLBACK do backfill (remove só o que veio do backfill, preserva
-- pagamentos registrados manualmente/gateway depois):
--   DELETE FROM public.contrato_parcelas WHERE origem_pagamento = 'backfill';
--   DELETE FROM public.contrato_parcelas WHERE status = 'em_aberto' AND pago_em IS NULL;
-- ==================================================================
