-- ==================================================================
-- Calendário: atribuição a VÁRIAS pessoas (event_attendees) + 'clevel'
-- - novo modo de audiência 'clevel' (somente admin/head)
-- - modo 'user' agora usa event_attendees (várias pessoas)
-- - atualiza o job de notificação 24h
-- Idempotente.
-- ==================================================================

-- 1) Permite audience_type = 'clevel'
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_audience_type_check;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_audience_type_check
  CHECK (audience_type IN ('all', 'squad', 'user', 'clevel'));

-- 2) Notificação 24h antes — alvos por modo de audiência
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
    -- pessoas específicas (várias) via event_attendees
    SELECT e.id AS event_id, e.title, e.start_at, ea.profile_id AS user_id
      FROM ev e JOIN public.event_attendees ea ON ea.event_id = e.id
      WHERE e.audience_type = 'user'
    UNION
    -- somente C-levels (apenas admin)
    SELECT e.id, e.title, e.start_at, p.id
      FROM ev e CROSS JOIN public.profiles p
      WHERE e.audience_type = 'clevel' AND p.archived_at IS NULL AND p.role = 'admin'
    UNION
    -- squad (todos os membros)
    SELECT e.id, e.title, e.start_at, sm.profile_id
      FROM ev e JOIN public.squad_membros sm ON sm.squad_id = e.squad_id
      WHERE e.audience_type = 'squad' AND e.squad_id IS NOT NULL
    UNION
    -- todos os usuários ativos
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
