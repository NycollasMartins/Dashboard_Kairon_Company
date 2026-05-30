-- ==================================================================
-- CALENDÁRIO — atribuição de evento (todos / squad / pessoa)
-- Aditivo e idempotente. Seguro mesmo se a migration base já rodou.
-- ==================================================================

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS squad_id      uuid,
  ADD COLUMN IF NOT EXISTS assignee_id   uuid;

-- CHECK do audience_type
DO $$ BEGIN
  ALTER TABLE public.calendar_events
    ADD CONSTRAINT calendar_events_audience_type_check
    CHECK (audience_type IN ('all', 'squad', 'user'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FK para squads
DO $$ BEGIN
  ALTER TABLE public.calendar_events
    ADD CONSTRAINT calendar_events_squad_id_fkey
    FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- FK para profiles (responsável)
DO $$ BEGIN
  ALTER TABLE public.calendar_events
    ADD CONSTRAINT calendar_events_assignee_id_fkey
    FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_calendar_events_squad    ON public.calendar_events (squad_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_assignee ON public.calendar_events (assignee_id);
