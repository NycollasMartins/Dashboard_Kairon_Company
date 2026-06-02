-- ==================================================================
-- Habilita Realtime (publicação supabase_realtime) nas tabelas usadas
-- pela aba Financeiro, para atualização em tempo real.
-- Idempotente — só adiciona o que ainda não está na publicação.
-- ==================================================================
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contratos', 'clientes', 'leads', 'campaign_metrics'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
