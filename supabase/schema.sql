-- =============================================================
-- Kairon Dashboard — Supabase schema
-- Run this entire file in the Supabase SQL Editor once.
-- =============================================================

-- ------------------------------------------------------------------
-- PRIVATE SCHEMA  (holds SECURITY DEFINER helper functions;
--                  not exposed via PostgREST Data API)
-- ------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

-- ------------------------------------------------------------------
-- PROFILES  (mirrors auth.users, extended with app-level fields)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text,
  full_name  text,
  role       text NOT NULL DEFAULT 'sdr'
               CHECK (role IN ('admin', 'social media', 'closer', 'sdr')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Automatically create a profile row on every new sign-up
-- Note: raw_user_meta_data is used only for display (full_name), never for authorization.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'sdr'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------
-- SQUADS
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.squads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  descricao   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- SQUAD_MEMBROS  (N:N — um usuário pode pertencer a vários squads)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.squad_membros (
  squad_id   uuid NOT NULL REFERENCES public.squads(id)   ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (squad_id, profile_id)
);

-- Index on profile_id for fast lookup "which squads does this user belong to?"
CREATE INDEX IF NOT EXISTS idx_squad_membros_profile_id ON public.squad_membros (profile_id);

-- ------------------------------------------------------------------
-- CLIENTES
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  email          text,
  telefone       text,
  empresa        text,
  status         text NOT NULL DEFAULT 'lead'
                   CHECK (status IN ('lead', 'qualificado', 'ativo', 'inativo')),
  squad_id       uuid REFERENCES public.squads(id)   ON DELETE SET NULL,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entregaveis    text[],
  notas          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- PROJETOS
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projetos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         text NOT NULL,
  descricao    text,
  status       text NOT NULL DEFAULT 'ativo'
                 CHECK (status IN ('ativo', 'pausado', 'concluido')),
  cliente_id   uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  prazo        date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------
-- TAREFAS
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tarefas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo         text NOT NULL,
  descricao      text,
  status         text NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'em_andamento', 'revisao', 'concluida')),
  prioridade     text NOT NULL DEFAULT 'media'
                   CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  prazo          date,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cliente_id     uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  projeto_id     uuid REFERENCES public.projetos(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ==================================================================
-- ROW LEVEL SECURITY
-- ==================================================================

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas       ENABLE ROW LEVEL SECURITY;

-- ==================================================================
-- PRIVATE HELPER FUNCTIONS
-- SECURITY DEFINER kept in private schema (not exposed via Data API)
-- ==================================================================

-- Returns all squad_ids the current user belongs to.
CREATE OR REPLACE FUNCTION private.get_user_squad_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY(
    SELECT squad_id
    FROM public.squad_membros
    WHERE profile_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- ==================================================================
-- RLS POLICIES
-- ==================================================================

-- PROFILES ---------------------------------------------------------

-- Any authenticated user can read profiles (needed for squad team display)
CREATE POLICY "profiles: authenticated read"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can update their own profile (non-role fields)
CREATE POLICY "profiles: self update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Only admins can update any profile (including the role column)
CREATE POLICY "profiles: admin update"
  ON public.profiles FOR UPDATE
  USING (private.is_admin());

-- SQUADS -----------------------------------------------------------

-- Any authenticated user can read squads (needed to assign clients to squads)
CREATE POLICY "squads: authenticated read"
  ON public.squads FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can create, update, or delete squads
CREATE POLICY "squads: admin manage"
  ON public.squads FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

-- SQUAD_MEMBROS ----------------------------------------------------

-- Any authenticated user can read squad memberships (needed for team display)
CREATE POLICY "squad_membros: authenticated read"
  ON public.squad_membros FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can add or remove squad members
CREATE POLICY "squad_membros: admin manage"
  ON public.squad_membros FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

-- CLIENTES ---------------------------------------------------------

-- Users see only clients belonging to their squads; admins see all
CREATE POLICY "clientes: squad select"
  ON public.clientes FOR SELECT
  USING (squad_id = ANY(private.get_user_squad_ids()) OR private.is_admin());

CREATE POLICY "clientes: squad insert"
  ON public.clientes FOR INSERT
  WITH CHECK (squad_id = ANY(private.get_user_squad_ids()) OR private.is_admin());

CREATE POLICY "clientes: squad update"
  ON public.clientes FOR UPDATE
  USING  (squad_id = ANY(private.get_user_squad_ids()) OR private.is_admin())
  WITH CHECK (squad_id = ANY(private.get_user_squad_ids()) OR private.is_admin());

CREATE POLICY "clientes: admin delete"
  ON public.clientes FOR DELETE
  USING (private.is_admin());

-- PROJETOS ---------------------------------------------------------

-- Users see projects whose client belongs to one of their squads
CREATE POLICY "projetos: squad select"
  ON public.projetos FOR SELECT
  USING (
    private.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id
        AND c.squad_id = ANY(private.get_user_squad_ids())
    )
  );

CREATE POLICY "projetos: squad insert"
  ON public.projetos FOR INSERT
  WITH CHECK (
    private.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id
        AND c.squad_id = ANY(private.get_user_squad_ids())
    )
  );

CREATE POLICY "projetos: squad update"
  ON public.projetos FOR UPDATE
  USING (
    private.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id
        AND c.squad_id = ANY(private.get_user_squad_ids())
    )
  )
  WITH CHECK (
    private.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id
        AND c.squad_id = ANY(private.get_user_squad_ids())
    )
  );

CREATE POLICY "projetos: admin delete"
  ON public.projetos FOR DELETE
  USING (private.is_admin());

-- TAREFAS ----------------------------------------------------------

-- Tarefas with a project → inherit squad access from the project's client.
-- Standalone tarefas with a client → must belong to user's squad.
-- Fully standalone (no project, no client) → any authenticated user can insert/see their own.
CREATE POLICY "tarefas: squad select"
  ON public.tarefas FOR SELECT
  USING (
    private.is_admin()
    OR (
      projeto_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.projetos p
        JOIN public.clientes c ON c.id = p.cliente_id
        WHERE p.id = projeto_id
          AND c.squad_id = ANY(private.get_user_squad_ids())
      )
    )
    OR (
      projeto_id IS NULL AND cliente_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.squad_id = ANY(private.get_user_squad_ids())
      )
    )
    OR (projeto_id IS NULL AND cliente_id IS NULL AND responsavel_id = auth.uid())
  );

CREATE POLICY "tarefas: squad insert"
  ON public.tarefas FOR INSERT
  WITH CHECK (
    private.is_admin()
    OR (
      projeto_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.projetos p
        JOIN public.clientes c ON c.id = p.cliente_id
        WHERE p.id = projeto_id
          AND c.squad_id = ANY(private.get_user_squad_ids())
      )
    )
    OR (
      projeto_id IS NULL AND cliente_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.squad_id = ANY(private.get_user_squad_ids())
      )
    )
    OR (projeto_id IS NULL AND cliente_id IS NULL)
  );

CREATE POLICY "tarefas: squad update"
  ON public.tarefas FOR UPDATE
  USING (
    private.is_admin()
    OR (
      projeto_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.projetos p
        JOIN public.clientes c ON c.id = p.cliente_id
        WHERE p.id = projeto_id
          AND c.squad_id = ANY(private.get_user_squad_ids())
      )
    )
    OR (
      projeto_id IS NULL AND cliente_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.squad_id = ANY(private.get_user_squad_ids())
      )
    )
    OR (projeto_id IS NULL AND cliente_id IS NULL AND responsavel_id = auth.uid())
  )
  WITH CHECK (
    private.is_admin()
    OR (
      projeto_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.projetos p
        JOIN public.clientes c ON c.id = p.cliente_id
        WHERE p.id = projeto_id
          AND c.squad_id = ANY(private.get_user_squad_ids())
      )
    )
    OR (
      projeto_id IS NULL AND cliente_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.clientes c
        WHERE c.id = cliente_id
          AND c.squad_id = ANY(private.get_user_squad_ids())
      )
    )
    OR (projeto_id IS NULL AND cliente_id IS NULL)
  );

CREATE POLICY "tarefas: admin delete"
  ON public.tarefas FOR DELETE
  USING (private.is_admin());

-- ==================================================================
-- LEADS  (capturados via Landing Page + Kanban comercial)
-- ==================================================================

CREATE TABLE IF NOT EXISTS public.leads (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome               text NOT NULL,
  empresa            text,
  email              text,
  telefone           text,
  momento_empresa    text,
  objetivo_principal text,
  status             text NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente', 'follow_up', 'reuniao_marcada')),
  origem             text NOT NULL DEFAULT 'landing_page',
  notas              text,
  responsavel_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cliente_id         uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_status      ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_responsavel ON public.leads (responsavel_id);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Trigger genérica de updated_at (reutilizável)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_touch_updated_at ON public.leads;
CREATE TRIGGER leads_touch_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Helper: true se o usuário atual é admin ou closer
CREATE OR REPLACE FUNCTION private.is_admin_or_closer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'closer')
  )
$$;

-- RLS: apenas admin e closer enxergam/alteram leads
CREATE POLICY "leads: closer/admin select"
  ON public.leads FOR SELECT
  USING (private.is_admin_or_closer());

CREATE POLICY "leads: closer/admin update"
  ON public.leads FOR UPDATE
  USING (private.is_admin_or_closer())
  WITH CHECK (private.is_admin_or_closer());

CREATE POLICY "leads: admin delete"
  ON public.leads FOR DELETE
  USING (private.is_admin());

-- Sem policy de INSERT: inserts vêm exclusivamente via
-- public.create_lead_from_webhook (SECURITY DEFINER).

-- RPC pública chamada pelo webhook da Landing Page.
-- Bypassa RLS via SECURITY DEFINER. Concedida à role 'anon'.
CREATE OR REPLACE FUNCTION public.create_lead_from_webhook(
  p_nome               text,
  p_empresa            text DEFAULT NULL,
  p_email              text DEFAULT NULL,
  p_telefone           text DEFAULT NULL,
  p_momento_empresa    text DEFAULT NULL,
  p_objetivo_principal text DEFAULT NULL,
  p_origem             text DEFAULT 'landing_page'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF p_nome IS NULL OR length(trim(p_nome)) = 0 THEN
    RAISE EXCEPTION 'nome is required';
  END IF;

  INSERT INTO public.leads (
    nome, empresa, email, telefone,
    momento_empresa, objetivo_principal, origem, status
  ) VALUES (
    trim(p_nome),
    NULLIF(trim(coalesce(p_empresa, '')), ''),
    NULLIF(trim(coalesce(p_email, '')), ''),
    NULLIF(trim(coalesce(p_telefone, '')), ''),
    NULLIF(trim(coalesce(p_momento_empresa, '')), ''),
    NULLIF(trim(coalesce(p_objetivo_principal, '')), ''),
    coalesce(p_origem, 'landing_page'),
    'pendente'
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_lead_from_webhook(
  text, text, text, text, text, text, text
) TO anon, authenticated;

-- ==================================================================
-- PROMOTE FIRST ADMIN
-- After your first sign-up, run the command below (replace the email):
--
--   UPDATE public.profiles SET role = 'admin'
--   WHERE email = 'seu@email.com';
--
-- ==================================================================
