-- =============================================================
-- Cron: expirar contratos vencidos
--
-- Roda public.expire_due_contracts() todo dia às 03:00 UTC
-- (= 00:00 BRT), marcando como 'expirado' todos os contratos
-- ativos cuja data_fim já passou.
--
-- Pré-requisitos:
--   1) Extensão pg_cron habilitada em Database → Extensions
--   2) Função public.expire_due_contracts() já existente (vem do schema.sql)
--
-- Rode este arquivo INTEIRO no Supabase SQL Editor uma vez por
-- ambiente (dev, staging, prod). É idempotente: re-executar
-- substitui o agendamento anterior sem erro.
--
-- Para verificar depois de aplicar, ver bloco de checagem no fim.
-- =============================================================

-- 1) Garante que a extensão pg_cron está disponível.
--    No Supabase, o painel já cuida disso; este CREATE EXTENSION
--    serve como guarda — falha rápido com mensagem clara se a
--    extensão não foi habilitada via UI.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) Remove agendamento anterior (se existir) antes de recriar.
--    Idempotência: chamar cron.schedule com nome existente daria erro.
DO $$
BEGIN
  PERFORM cron.unschedule('expirar-contratos');
EXCEPTION
  WHEN OTHERS THEN
    -- Job ainda não existe: ignora.
    NULL;
END;
$$;

-- 3) Agenda o job.
--    Sintaxe cron: minuto hora dia-mês mês dia-semana
--    '0 3 * * *' = todo dia às 03:00 UTC (= 00:00 horário de Brasília).
--    Ajuste o segundo número se quiser outro horário UTC.
SELECT cron.schedule(
  'expirar-contratos',
  '0 3 * * *',
  $$ SELECT public.expire_due_contracts(); $$
);

-- =============================================================
-- VERIFICAÇÃO (rode separadamente após aplicar)
-- =============================================================
--
-- Listar o job agendado:
--   SELECT jobid, jobname, schedule, command, active
--   FROM cron.job
--   WHERE jobname = 'expirar-contratos';
--
-- Ver últimas execuções (popula só depois da primeira rodada):
--   SELECT jobid, status, return_message, start_time, end_time
--   FROM cron.job_run_details
--   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'expirar-contratos')
--   ORDER BY start_time DESC
--   LIMIT 10;
--
-- Forçar execução agora (sem esperar 03:00 UTC):
--   SELECT public.expire_due_contracts();
--
-- Pausar temporariamente (sem deletar):
--   UPDATE cron.job SET active = false WHERE jobname = 'expirar-contratos';
--
-- Reativar:
--   UPDATE cron.job SET active = true  WHERE jobname = 'expirar-contratos';
--
-- Remover por completo:
--   SELECT cron.unschedule('expirar-contratos');
-- =============================================================
