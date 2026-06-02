-- ==================================================================
-- SISTEMA DE NOTIFICAÇÕES
--  - tabela notifications (por usuário) + RLS + realtime
--  - novo LEAD => notifica os usuários do CRM (trigger)
--  - EVENTO em 24h => notifica quem está atribuído (pg_cron)
-- Idempotente.
-- ==================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        text NOT NULL DEFAULT 'info',     -- 'lead' | 'event' | 'info'
  title       text NOT NULL,
  body        text,
  link        text,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user   ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Cada um vê/atualiza/apaga só as PRÓPRIAS notificações.
-- (Não há policy de INSERT: ninguém insere pelo cliente; só os gatilhos/job
--  SECURITY DEFINER, que ignoram RLS.)
DROP POLICY IF EXISTS "notifications: own read"   ON public.notifications;
DROP POLICY IF EXISTS "notifications: own update" ON public.notifications;
DROP POLICY IF EXISTS "notifications: own delete" ON public.notifications;
CREATE POLICY "notifications: own read"
  ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications: own update"
  ON public.notifications FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications: own delete"
  ON public.notifications FOR DELETE USING (user_id = auth.uid());

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ------------------------------------------------------------------
-- Novo LEAD => notifica os usuários do CRM
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notify_new_lead()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT p.id,
         'lead',
         'Novo lead',
         COALESCE(NEW.nome, 'Lead') || COALESCE(' · ' || NEW.empresa, ''),
         '/comercial',
         jsonb_build_object('lead_id', NEW.id)
  FROM public.profiles p
  WHERE p.archived_at IS NULL
    AND p.role IN ('admin', 'closer', 'head', 'dev', 'sdr', 'bdr');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_notify_new ON public.leads;
CREATE TRIGGER leads_notify_new
  AFTER INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION private.notify_new_lead();

-- ------------------------------------------------------------------
-- EVENTO do calendário em 24h => notifica quem está atribuído
-- ------------------------------------------------------------------
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS notified_24h_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_upcoming_events()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH ev AS (
    SELECT * FROM public.calendar_events
    WHERE start_at > now()
      AND start_at <= now() + interval '24 hours'
      AND notified_24h_at IS NULL
  ),
  targets AS (
    -- atribuído a uma pessoa
    SELECT e.id AS event_id, e.title, e.start_at, e.assignee_id AS user_id
      FROM ev e WHERE e.audience_type = 'user' AND e.assignee_id IS NOT NULL
    UNION
    -- atribuído a um squad (todos os membros)
    SELECT e.id, e.title, e.start_at, sm.profile_id
      FROM ev e JOIN public.squad_membros sm ON sm.squad_id = e.squad_id
      WHERE e.audience_type = 'squad' AND e.squad_id IS NOT NULL
    UNION
    -- para todos (todos os usuários ativos)
    SELECT e.id, e.title, e.start_at, p.id
      FROM ev e CROSS JOIN public.profiles p
      WHERE e.audience_type = 'all' AND p.archived_at IS NULL
  )
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT t.user_id, 'event', 'Evento em 24h', t.title, '/calendario',
         jsonb_build_object('event_id', t.event_id, 'start_at', t.start_at)
  FROM targets t
  WHERE t.user_id IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.calendar_events
     SET notified_24h_at = now()
   WHERE start_at > now()
     AND start_at <= now() + interval '24 hours'
     AND notified_24h_at IS NULL;

  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.notify_upcoming_events() TO authenticated;

-- pg_cron: roda de hora em hora.
DO $$ BEGIN PERFORM cron.unschedule('notify-upcoming-events'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('notify-upcoming-events', '0 * * * *', $$ SELECT public.notify_upcoming_events(); $$);
