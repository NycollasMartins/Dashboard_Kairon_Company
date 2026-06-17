-- ------------------------------------------------------------------
-- Reunião a partir do Pipeline de Leads
-- ------------------------------------------------------------------
-- Permite que CLOSERS criem eventos no calendário ao mover um lead para
-- "Reunião Marcada". Admin/head/dev já gerenciam via a policy
-- "calendar_events: admin/head manage". Aqui liberamos apenas INSERT para
-- closers — eles NÃO podem editar nem excluir eventos de outras pessoas.
-- ------------------------------------------------------------------

-- calendar_events: closer pode inserir -----------------------------
DROP POLICY IF EXISTS "calendar_events: closer insert" ON public.calendar_events;
CREATE POLICY "calendar_events: closer insert"
  ON public.calendar_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'closer'
    )
  );

-- event_attendees: closer pode inserir participantes ----------------
DROP POLICY IF EXISTS "event_attendees: closer insert" ON public.event_attendees;
CREATE POLICY "event_attendees: closer insert"
  ON public.event_attendees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'closer'
    )
  );
