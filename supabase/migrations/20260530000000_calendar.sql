-- ==================================================================
-- CALENDÁRIO (eventos internos + integração Google Calendar)
-- Migration idempotente — pode ser reaplicada com segurança.
--
-- Aplicar com:
--   supabase db push                       (CLI, projeto linkado)
-- ou colar o conteúdo no SQL Editor do painel Supabase.
--
-- Padrões seguidos (iguais ao schema.sql / campaigns existentes):
--   - PK uuid DEFAULT gen_random_uuid()
--   - created_at/updated_at timestamptz DEFAULT now()
--   - trigger public.touch_updated_at() para updated_at
--   - RLS habilitada.
--
-- Permissões (decisão do projeto):
--   - LEITURA  -> qualquer usuário autenticado (todos veem o calendário)
--   - GESTÃO   -> apenas admin e head (private.is_admin_or_head())
-- ==================================================================

-- ------------------------------------------------------------------
-- TABELA: calendar_events
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  type            text NOT NULL DEFAULT 'meeting'
                    CHECK (type IN ('meeting', 'activity', 'delivery')),
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  all_day         boolean NOT NULL DEFAULT false,
  location        text,
  google_event_id text,                                   -- id do evento no Google (nullable)
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_time_valid CHECK (end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON public.calendar_events (start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type  ON public.calendar_events (type);
-- google_event_id único quando presente (evita duplicar eventos no pull do Google)
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_google_uid
  ON public.calendar_events (google_event_id)
  WHERE google_event_id IS NOT NULL;

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- TABELA: event_attendees (participantes — auxiliar, opcional no UI v1)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_attendees (
  event_id   uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id)        ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_profile ON public.event_attendees (profile_id);

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- TABELA: google_calendar_credentials (singleton — 1 calendário da empresa)
--
-- Guarda o refresh/access token do Google. NUNCA deve ser exposta ao
-- cliente: o acesso é revogado para anon/authenticated e só o
-- service_role (usado pelas Edge Functions) consegue ler/escrever.
-- O frontend consulta o status via public.google_calendar_status().
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_calendar_credentials (
  id                  boolean PRIMARY KEY DEFAULT true,   -- garante 1 única linha
  refresh_token       text,
  access_token        text,
  token_expires_at    timestamptz,
  google_calendar_id  text NOT NULL DEFAULT 'primary',
  oauth_state         text,                               -- CSRF do fluxo OAuth (efêmero)
  oauth_state_at      timestamptz,
  connected_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at        timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT google_calendar_credentials_singleton CHECK (id)
);

ALTER TABLE public.google_calendar_credentials ENABLE ROW LEVEL SECURITY;

-- Bloqueia totalmente o acesso de anon/authenticated (só service_role acessa).
REVOKE ALL ON public.google_calendar_credentials FROM anon, authenticated;

-- ------------------------------------------------------------------
-- Triggers de updated_at (reaproveita a função genérica do schema)
-- ------------------------------------------------------------------
DROP TRIGGER IF EXISTS calendar_events_touch_updated_at ON public.calendar_events;
CREATE TRIGGER calendar_events_touch_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS google_calendar_credentials_touch_updated_at ON public.google_calendar_credentials;
CREATE TRIGGER google_calendar_credentials_touch_updated_at
  BEFORE UPDATE ON public.google_calendar_credentials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------------
-- RLS — leitura para todos os autenticados; gestão para admin/head.
-- ------------------------------------------------------------------

-- calendar_events ---------------------------------------------------
DROP POLICY IF EXISTS "calendar_events: authenticated read" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events: admin/head manage"  ON public.calendar_events;

CREATE POLICY "calendar_events: authenticated read"
  ON public.calendar_events FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "calendar_events: admin/head manage"
  ON public.calendar_events FOR ALL
  USING (private.is_admin_or_head())
  WITH CHECK (private.is_admin_or_head());

-- event_attendees ---------------------------------------------------
DROP POLICY IF EXISTS "event_attendees: authenticated read" ON public.event_attendees;
DROP POLICY IF EXISTS "event_attendees: admin/head manage"  ON public.event_attendees;

CREATE POLICY "event_attendees: authenticated read"
  ON public.event_attendees FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "event_attendees: admin/head manage"
  ON public.event_attendees FOR ALL
  USING (private.is_admin_or_head())
  WITH CHECK (private.is_admin_or_head());

-- google_calendar_credentials --------------------------------------
-- (RLS habilitada e SEM policies para authenticated => acesso negado;
--  apenas o service_role das Edge Functions consegue operar a tabela.)

-- ------------------------------------------------------------------
-- FUNÇÃO: status da conexão Google (sem expor tokens)
-- Retorna informações seguras apenas para admin/head.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.google_calendar_status()
RETURNS TABLE (
  connected          boolean,
  google_calendar_id text,
  connected_at       timestamptz,
  connected_by_name  text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    (c.refresh_token IS NOT NULL) AS connected,
    c.google_calendar_id,
    c.connected_at,
    p.full_name AS connected_by_name
  FROM public.google_calendar_credentials c
  LEFT JOIN public.profiles p ON p.id = c.connected_by
  WHERE private.is_admin_or_head()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.google_calendar_status() FROM public;
GRANT EXECUTE ON FUNCTION public.google_calendar_status() TO authenticated;
