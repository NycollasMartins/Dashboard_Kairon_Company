-- ==================================================================
-- Calendário: lembrete adicional de 20 MINUTOS antes do evento
-- - Mantém o lembrete existente de 24h.
-- - Adiciona coluna notified_20m_at (idempotência do 2º lembrete).
-- - notify_upcoming_events() passa a disparar os dois lembretes (24h e 20min).
-- - pg_cron passa a rodar a cada 5 minutos (precisão p/ a janela de 20min).
-- Idempotente.
-- ==================================================================

-- 1) Coluna de controle do lembrete de 20 minutos
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS notified_20m_at timestamptz;

-- 2) Função: dispara lembrete de 24h E de 20min, cada um uma única vez.
CREATE OR REPLACE FUNCTION public.notify_upcoming_events()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private
AS $$
DECLARE
  v_count integer := 0;
  v_part  integer;
BEGIN
  -- ===================== Lembrete: 24 horas antes =====================
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
         jsonb_build_object('event_id', t.event_id, 'start_at', t.start_at, 'reminder', '24h')
  FROM targets t
  WHERE t.user_id IS NOT NULL;
  GET DIAGNOSTICS v_part = ROW_COUNT;
  v_count := v_count + v_part;

  UPDATE public.calendar_events
     SET notified_24h_at = now()
   WHERE start_at > now()
     AND start_at <= now() + interval '24 hours'
     AND notified_24h_at IS NULL;

  -- ===================== Lembrete: 20 minutos antes ====================
  WITH ev AS (
    SELECT * FROM public.calendar_events
    WHERE start_at > now()
      AND start_at <= now() + interval '20 minutes'
      AND notified_20m_at IS NULL
  ),
  targets AS (
    SELECT e.id AS event_id, e.title, e.start_at, ea.profile_id AS user_id
      FROM ev e JOIN public.event_attendees ea ON ea.event_id = e.id
      WHERE e.audience_type = 'user'
    UNION
    SELECT e.id, e.title, e.start_at, p.id
      FROM ev e CROSS JOIN public.profiles p
      WHERE e.audience_type = 'clevel' AND p.archived_at IS NULL AND p.role = 'admin'
    UNION
    SELECT e.id, e.title, e.start_at, sm.profile_id
      FROM ev e JOIN public.squad_membros sm ON sm.squad_id = e.squad_id
      WHERE e.audience_type = 'squad' AND e.squad_id IS NOT NULL
    UNION
    SELECT e.id, e.title, e.start_at, p.id
      FROM ev e CROSS JOIN public.profiles p
      WHERE e.audience_type = 'all' AND p.archived_at IS NULL
  )
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT t.user_id, 'event', 'Evento em 20 min', t.title, '/calendario',
         jsonb_build_object('event_id', t.event_id, 'start_at', t.start_at, 'reminder', '20m')
  FROM targets t
  WHERE t.user_id IS NOT NULL;
  GET DIAGNOSTICS v_part = ROW_COUNT;
  v_count := v_count + v_part;

  UPDATE public.calendar_events
     SET notified_20m_at = now()
   WHERE start_at > now()
     AND start_at <= now() + interval '20 minutes'
     AND notified_20m_at IS NULL;

  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.notify_upcoming_events() TO authenticated;

-- 3) pg_cron: a cada 5 minutos (precisão para a janela de 20 min).
DO $$ BEGIN PERFORM cron.unschedule('notify-upcoming-events'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('notify-upcoming-events', '*/5 * * * *', $$ SELECT public.notify_upcoming_events(); $$);
