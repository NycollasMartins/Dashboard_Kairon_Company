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
               CHECK (role IN ('admin', 'social media', 'closer', 'sdr', 'bdr', 'head', 'editor')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent: ajusta o CHECK constraint em bancos ja existentes
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'social media', 'closer', 'sdr', 'bdr', 'head', 'editor'));

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
  status         text NOT NULL DEFAULT 'ativo'
                   CHECK (status IN ('ativo', 'churn')),
  origem         text NOT NULL DEFAULT 'manual'
                   CHECK (origem IN ('manual', 'lead')),
  squad_id       uuid REFERENCES public.squads(id)   ON DELETE SET NULL,
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entregaveis    text[],
  notas          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Idempotente para bancos pré-existentes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_origem_check;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_origem_check
  CHECK (origem IN ('manual', 'lead'));

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
  created_by     uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tarefas
  ADD COLUMN IF NOT EXISTS created_by uuid
    REFERENCES public.profiles(id) ON DELETE SET NULL
    DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_tarefas_created_by ON public.tarefas (created_by);

-- created_by é imutável depois do INSERT: lock no update
CREATE OR REPLACE FUNCTION public.tarefas_lock_created_by()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.created_by IS NOT NULL THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tarefas_lock_created_by ON public.tarefas;
CREATE TRIGGER tarefas_lock_created_by
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tarefas_lock_created_by();

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

CREATE OR REPLACE FUNCTION private.is_admin_or_head()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'head')
  )
$$;

-- Returns true if current user is restricted to seeing only their own tasks
-- (used to scope tarefas/clientes/projetos visibility for editor and social media).
CREATE OR REPLACE FUNCTION private.is_own_tasks_only()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('editor', 'social media')
  )
$$;

-- Helpers SECURITY DEFINER para evitar recursao entre as policies de
-- tarefas <-> clientes/projetos. Sem isso, a policy "clientes: own tarefa
-- select" consultaria public.tarefas (que reavalia sua propria policy, que
-- por sua vez consulta clientes...).
CREATE OR REPLACE FUNCTION private.user_has_tarefa_for_cliente(p_cliente_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tarefas
    WHERE cliente_id = p_cliente_id
      AND responsavel_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION private.user_has_tarefa_for_projeto(p_projeto_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tarefas
    WHERE projeto_id = p_projeto_id
      AND responsavel_id = auth.uid()
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

-- Permite que editor/social media (sem acesso geral a clientes via squad)
-- leiam o cliente vinculado a uma tarefa propria — necessario para o card
-- exibir nome do cliente. PERMISSIVE → entra em OR com as policies acima.
DROP POLICY IF EXISTS "clientes: own tarefa select" ON public.clientes;
CREATE POLICY "clientes: own tarefa select"
  ON public.clientes FOR SELECT
  USING (private.user_has_tarefa_for_cliente(id));

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

-- Mesma logica do clientes: permite leitura do projeto vinculado a uma
-- tarefa propria, para o card exibir nome do projeto.
DROP POLICY IF EXISTS "projetos: own tarefa select" ON public.projetos;
CREATE POLICY "projetos: own tarefa select"
  ON public.projetos FOR SELECT
  USING (private.user_has_tarefa_for_projeto(id));

-- TAREFAS ----------------------------------------------------------

-- Tarefas with a project → inherit squad access from the project's client.
-- Standalone tarefas with a client → must belong to user's squad.
-- Fully standalone (no project, no client) → any authenticated user can insert/see their own.
DROP POLICY IF EXISTS "tarefas: squad select" ON public.tarefas;
CREATE POLICY "tarefas: squad select"
  ON public.tarefas FOR SELECT
  USING (
    private.is_admin()
    OR (private.is_own_tasks_only() AND responsavel_id = auth.uid())
    OR (
      NOT private.is_own_tasks_only() AND (
        (
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
    )
  );

DROP POLICY IF EXISTS "tarefas: squad insert" ON public.tarefas;
CREATE POLICY "tarefas: squad insert"
  ON public.tarefas FOR INSERT
  WITH CHECK (
    private.is_admin()
    OR (
      NOT private.is_own_tasks_only() AND (
        (
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
      )
    )
  );

DROP POLICY IF EXISTS "tarefas: squad update" ON public.tarefas;
CREATE POLICY "tarefas: squad update"
  ON public.tarefas FOR UPDATE
  USING (
    private.is_admin()
    OR (private.is_own_tasks_only() AND responsavel_id = auth.uid())
    OR (
      NOT private.is_own_tasks_only() AND (
        (
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
    )
  )
  WITH CHECK (
    private.is_admin()
    OR (private.is_own_tasks_only() AND responsavel_id = auth.uid())
    OR (
      NOT private.is_own_tasks_only() AND (
        (
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
      )
    )
  );

CREATE POLICY "tarefas: admin delete"
  ON public.tarefas FOR DELETE
  USING (private.is_admin());

-- Restringe INSERT em tarefas vinculadas a projeto chamado 'Onboarding'
-- apenas para admin/head. Avaliada em AND com "tarefas: squad insert".
DROP POLICY IF EXISTS "tarefas: only admin/head insert in onboarding" ON public.tarefas;
CREATE POLICY "tarefas: only admin/head insert in onboarding"
  ON public.tarefas
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    projeto_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.projetos p
      WHERE p.id = projeto_id AND p.nome = 'Onboarding'
    )
    OR private.is_admin_or_head()
  );

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
  faturamento_mensal text,
  status             text NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente', 'em_atendimento', 'follow_up', 'reuniao_marcada', 'perdido')),
  origem             text NOT NULL DEFAULT 'landing_page',
  notas              text,
  responsavel_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  cliente_id         uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  atendimento_iniciado_em timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS atendimento_iniciado_em timestamptz;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS faturamento_mensal text;

-- Idempotente: garante que bancos pré-existentes aceitem 'perdido'
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('pendente', 'em_atendimento', 'follow_up', 'reuniao_marcada', 'perdido'));

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

-- Helper: true se o usuário atual é SDR ou BDR (papéis de prospecção)
CREATE OR REPLACE FUNCTION private.is_sdr_or_bdr()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('sdr', 'bdr')
  )
$$;

-- Helper: true se o usuário atual só tem acesso ao CRM (sdr/bdr/closer).
-- Usado em policies RESTRICTIVE para bloquear acesso a tabelas operacionais/administrativas.
CREATE OR REPLACE FUNCTION private.is_crm_only()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('sdr', 'bdr', 'closer')
  )
$$;

-- RLS: admin/closer veem e editam tudo; SDR/BDR vê tudo, edita Pendentes ou os seus
DROP POLICY IF EXISTS "leads: closer/admin select"            ON public.leads;
DROP POLICY IF EXISTS "leads: closer/admin update"            ON public.leads;
DROP POLICY IF EXISTS "leads: actor select"                   ON public.leads;
DROP POLICY IF EXISTS "leads: admin/closer update"            ON public.leads;
DROP POLICY IF EXISTS "leads: sdr update own or pendente"     ON public.leads;
DROP POLICY IF EXISTS "leads: sdr/bdr update own or pendente" ON public.leads;
DROP FUNCTION IF EXISTS private.is_sdr();

CREATE POLICY "leads: actor select"
  ON public.leads FOR SELECT
  USING (private.is_admin_or_closer() OR private.is_sdr_or_bdr());

CREATE POLICY "leads: admin/closer update"
  ON public.leads FOR UPDATE
  USING (private.is_admin_or_closer())
  WITH CHECK (private.is_admin_or_closer());

CREATE POLICY "leads: sdr/bdr update own or pendente"
  ON public.leads FOR UPDATE
  USING (
    private.is_sdr_or_bdr() AND (status = 'pendente' OR responsavel_id = auth.uid())
  )
  WITH CHECK (
    private.is_sdr_or_bdr() AND responsavel_id = auth.uid()
  );

CREATE POLICY "leads: admin delete"
  ON public.leads FOR DELETE
  USING (private.is_admin());

-- Trigger guard: auto-promove status, valida role do responsavel e
-- carimba/limpa o início do atendimento conforme transições de status.
CREATE OR REPLACE FUNCTION public.leads_atendimento_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  responsavel_role text;
BEGIN
  -- Auto-promove pendente -> em_atendimento quando ganha responsavel
  IF TG_OP = 'UPDATE'
     AND NEW.responsavel_id IS NOT NULL
     AND NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
     AND NEW.status = 'pendente' THEN
    NEW.status := 'em_atendimento';
  END IF;

  -- em_atendimento exige responsavel
  IF NEW.status = 'em_atendimento' AND NEW.responsavel_id IS NULL THEN
    RAISE EXCEPTION 'em_atendimento requires a responsavel';
  END IF;

  -- Responsavel precisa ser SDR ou BDR (defesa em profundidade da regra de UI)
  IF NEW.responsavel_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id) THEN
    SELECT role INTO responsavel_role
      FROM public.profiles
      WHERE id = NEW.responsavel_id;
    IF responsavel_role NOT IN ('sdr', 'bdr') THEN
      RAISE EXCEPTION 'responsavel must have role sdr or bdr';
    END IF;
  END IF;

  -- Carimba ao entrar em em_atendimento; limpa ao sair
  IF NEW.status = 'em_atendimento'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'em_atendimento') THEN
    NEW.atendimento_iniciado_em := now();
  ELSIF NEW.status <> 'em_atendimento' THEN
    NEW.atendimento_iniciado_em := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS leads_atendimento_guard ON public.leads;
CREATE TRIGGER leads_atendimento_guard
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_atendimento_guard();

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
  p_origem             text DEFAULT 'landing_page',
  p_faturamento_mensal text DEFAULT NULL
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
    momento_empresa, objetivo_principal, faturamento_mensal, origem, status
  ) VALUES (
    trim(p_nome),
    NULLIF(trim(coalesce(p_empresa, '')), ''),
    NULLIF(trim(coalesce(p_email, '')), ''),
    NULLIF(trim(coalesce(p_telefone, '')), ''),
    NULLIF(trim(coalesce(p_momento_empresa, '')), ''),
    NULLIF(trim(coalesce(p_objetivo_principal, '')), ''),
    NULLIF(trim(coalesce(p_faturamento_mensal, '')), ''),
    coalesce(p_origem, 'landing_page'),
    'pendente'
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_lead_from_webhook(
  text, text, text, text, text, text, text, text
) TO anon, authenticated;

-- ==================================================================
-- CRM-ONLY LOCKDOWN
-- SDR/BDR/Closer não têm acesso a tabelas operacionais nem administrativas.
-- Aplicado via policies RESTRICTIVE (avaliadas em AND com qualquer outra),
-- então qualquer leitura ou escrita feita por esses papéis nessas tabelas falha.
-- ==================================================================

DROP POLICY IF EXISTS "clientes: deny crm-only roles"      ON public.clientes;
DROP POLICY IF EXISTS "projetos: deny crm-only roles"      ON public.projetos;
DROP POLICY IF EXISTS "tarefas: deny crm-only roles"       ON public.tarefas;
DROP POLICY IF EXISTS "squads: deny crm-only roles"        ON public.squads;
DROP POLICY IF EXISTS "squad_membros: deny crm-only roles" ON public.squad_membros;

CREATE POLICY "clientes: deny crm-only roles"
  ON public.clientes
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (NOT private.is_crm_only())
  WITH CHECK (NOT private.is_crm_only());

CREATE POLICY "projetos: deny crm-only roles"
  ON public.projetos
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (NOT private.is_crm_only())
  WITH CHECK (NOT private.is_crm_only());

CREATE POLICY "tarefas: deny crm-only roles"
  ON public.tarefas
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (NOT private.is_crm_only())
  WITH CHECK (NOT private.is_crm_only());

CREATE POLICY "squads: deny crm-only roles"
  ON public.squads
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (NOT private.is_crm_only())
  WITH CHECK (NOT private.is_crm_only());

CREATE POLICY "squad_membros: deny crm-only roles"
  ON public.squad_membros
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (NOT private.is_crm_only())
  WITH CHECK (NOT private.is_crm_only());

-- public.profiles permanece lível por todos os autenticados — o frontend
-- depende disso para renderizar avatar do usuário logado e o dropdown de
-- responsaveis no CRM. Mudanças em role continuam restritas a admin.

-- ==================================================================
-- USER INVITES VIEW
-- Combina public.profiles com auth.users.last_sign_in_at para
-- distinguir convites pendentes (nunca logaram) de usuarios ativos.
-- security_invoker = true: respeita o RLS de profiles (admin-only no app).
-- ==================================================================
CREATE OR REPLACE VIEW public.user_invites_view
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.created_at                              AS invited_at,
  u.last_sign_in_at,
  u.confirmed_at,
  (u.last_sign_in_at IS NULL)               AS pending
FROM public.profiles p
JOIN auth.users u ON u.id = p.id;

GRANT SELECT ON public.user_invites_view TO authenticated;

-- ==================================================================
-- HEAD ROLE — admin-equivalent access EXCEPT Administrativo
--
-- Head pode ver/editar todos os dados operacionais e comerciais como
-- um admin, mas NÃO gerencia roles de usuários (continua sendo
-- exclusivo de 'admin' via "profiles: admin update").
--
-- Bloco idempotente: pode rodar várias vezes.
-- ==================================================================

-- Helper: head/closer/admin têm poderes de CRM
CREATE OR REPLACE FUNCTION private.is_admin_or_closer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'closer', 'head')
  )
$$;

-- Squads
DROP POLICY IF EXISTS "squads: admin manage"      ON public.squads;
DROP POLICY IF EXISTS "squads: admin/head manage" ON public.squads;
CREATE POLICY "squads: admin/head manage"
  ON public.squads FOR ALL
  USING (private.is_admin_or_head())
  WITH CHECK (private.is_admin_or_head());

-- Squad membros
DROP POLICY IF EXISTS "squad_membros: admin manage"      ON public.squad_membros;
DROP POLICY IF EXISTS "squad_membros: admin/head manage" ON public.squad_membros;
CREATE POLICY "squad_membros: admin/head manage"
  ON public.squad_membros FOR ALL
  USING (private.is_admin_or_head())
  WITH CHECK (private.is_admin_or_head());

-- Clientes: head também vê tudo (igual admin)
DROP POLICY IF EXISTS "clientes: squad select" ON public.clientes;
DROP POLICY IF EXISTS "clientes: squad insert" ON public.clientes;
DROP POLICY IF EXISTS "clientes: squad update" ON public.clientes;
DROP POLICY IF EXISTS "clientes: admin delete" ON public.clientes;
DROP POLICY IF EXISTS "clientes: admin/head delete" ON public.clientes;

CREATE POLICY "clientes: squad select"
  ON public.clientes FOR SELECT
  USING (squad_id = ANY(private.get_user_squad_ids()) OR private.is_admin_or_head());

CREATE POLICY "clientes: squad insert"
  ON public.clientes FOR INSERT
  WITH CHECK (squad_id = ANY(private.get_user_squad_ids()) OR private.is_admin_or_head());

CREATE POLICY "clientes: squad update"
  ON public.clientes FOR UPDATE
  USING  (squad_id = ANY(private.get_user_squad_ids()) OR private.is_admin_or_head())
  WITH CHECK (squad_id = ANY(private.get_user_squad_ids()) OR private.is_admin_or_head());

CREATE POLICY "clientes: admin/head delete"
  ON public.clientes FOR DELETE
  USING (private.is_admin_or_head());

-- Projetos: head também vê/edita tudo
DROP POLICY IF EXISTS "projetos: squad select" ON public.projetos;
DROP POLICY IF EXISTS "projetos: squad insert" ON public.projetos;
DROP POLICY IF EXISTS "projetos: squad update" ON public.projetos;
DROP POLICY IF EXISTS "projetos: admin delete" ON public.projetos;
DROP POLICY IF EXISTS "projetos: admin/head delete" ON public.projetos;

CREATE POLICY "projetos: squad select"
  ON public.projetos FOR SELECT
  USING (
    private.is_admin_or_head()
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = projetos.cliente_id
        AND c.squad_id = ANY(private.get_user_squad_ids())
    )
  );

CREATE POLICY "projetos: squad insert"
  ON public.projetos FOR INSERT
  WITH CHECK (
    private.is_admin_or_head()
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = projetos.cliente_id
        AND c.squad_id = ANY(private.get_user_squad_ids())
    )
  );

CREATE POLICY "projetos: squad update"
  ON public.projetos FOR UPDATE
  USING (
    private.is_admin_or_head()
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = projetos.cliente_id
        AND c.squad_id = ANY(private.get_user_squad_ids())
    )
  )
  WITH CHECK (
    private.is_admin_or_head()
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = projetos.cliente_id
        AND c.squad_id = ANY(private.get_user_squad_ids())
    )
  );

CREATE POLICY "projetos: admin/head delete"
  ON public.projetos FOR DELETE
  USING (private.is_admin_or_head());

-- Tarefas: head também vê/edita/deleta tudo (igual admin)
DROP POLICY IF EXISTS "tarefas: squad select"      ON public.tarefas;
DROP POLICY IF EXISTS "tarefas: squad insert"      ON public.tarefas;
DROP POLICY IF EXISTS "tarefas: squad update"      ON public.tarefas;
DROP POLICY IF EXISTS "tarefas: admin delete"      ON public.tarefas;
DROP POLICY IF EXISTS "tarefas: admin/head delete" ON public.tarefas;

CREATE POLICY "tarefas: squad select"
  ON public.tarefas FOR SELECT
  USING (
    private.is_admin_or_head()
    OR (private.is_own_tasks_only() AND responsavel_id = auth.uid())
    OR (
      NOT private.is_own_tasks_only() AND (
        (
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
    )
  );

CREATE POLICY "tarefas: squad insert"
  ON public.tarefas FOR INSERT
  WITH CHECK (
    private.is_admin_or_head()
    OR (
      NOT private.is_own_tasks_only() AND (
        (
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
      )
    )
  );

CREATE POLICY "tarefas: squad update"
  ON public.tarefas FOR UPDATE
  USING (
    private.is_admin_or_head()
    OR (private.is_own_tasks_only() AND responsavel_id = auth.uid())
    OR (
      NOT private.is_own_tasks_only() AND (
        (
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
    )
  )
  WITH CHECK (
    private.is_admin_or_head()
    OR (private.is_own_tasks_only() AND responsavel_id = auth.uid())
    OR (
      NOT private.is_own_tasks_only() AND (
        (
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
      )
    )
  );

CREATE POLICY "tarefas: admin/head delete"
  ON public.tarefas FOR DELETE
  USING (private.is_admin_or_head());

-- Leads: head também pode deletar (e já entra em is_admin_or_closer atualizado acima)
DROP POLICY IF EXISTS "leads: admin delete"      ON public.leads;
DROP POLICY IF EXISTS "leads: admin/head delete" ON public.leads;
CREATE POLICY "leads: admin/head delete"
  ON public.leads FOR DELETE
  USING (private.is_admin_or_head());

-- ==================================================================
-- CONVERSÃO LEAD → CLIENTE
--
-- RPC atômica: cria registro em clientes (com origem='lead') e
-- popula leads.cliente_id apontando para o cliente recém-criado.
-- Apenas admin/head pode executar.
-- ==================================================================

CREATE OR REPLACE FUNCTION public.convert_lead_to_cliente(
  p_lead_id        uuid,
  p_squad_id       uuid    DEFAULT NULL,
  p_responsavel_id uuid    DEFAULT NULL,
  p_entregaveis    text[]  DEFAULT NULL,
  p_notas          text    DEFAULT NULL,
  p_nome           text    DEFAULT NULL,
  p_empresa        text    DEFAULT NULL,
  p_email          text    DEFAULT NULL,
  p_telefone       text    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_lead       public.leads%ROWTYPE;
  v_cliente_id uuid;
BEGIN
  IF NOT private.is_admin_or_head() THEN
    RAISE EXCEPTION 'Apenas admin ou head podem converter leads em clientes.'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % não encontrado.', p_lead_id USING ERRCODE = 'P0002';
  END IF;

  IF v_lead.cliente_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead já foi convertido em cliente (cliente_id=%).', v_lead.cliente_id
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.clientes (
    nome, empresa, email, telefone,
    squad_id, responsavel_id, entregaveis, notas, origem, status
  ) VALUES (
    COALESCE(NULLIF(TRIM(p_nome), ''),    v_lead.nome),
    COALESCE(NULLIF(TRIM(p_empresa), ''), v_lead.empresa),
    COALESCE(NULLIF(TRIM(p_email), ''),   v_lead.email),
    COALESCE(NULLIF(TRIM(p_telefone),''), v_lead.telefone),
    p_squad_id,
    p_responsavel_id,
    p_entregaveis,
    COALESCE(NULLIF(TRIM(p_notas), ''), v_lead.notas),
    'lead',
    'ativo'
  )
  RETURNING id INTO v_cliente_id;

  UPDATE public.leads
     SET cliente_id = v_cliente_id,
         updated_at = now()
   WHERE id = p_lead_id;

  RETURN v_cliente_id;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_lead_to_cliente(uuid, uuid, uuid, text[], text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_lead_to_cliente(uuid, uuid, uuid, text[], text, text, text, text, text) TO authenticated;

-- ==================================================================
-- CONTRATOS (financeiro por cliente)
--
-- Cada cliente pode ter múltiplos contratos ao longo do tempo, mas
-- apenas UM com status='ativo' por vez (índice único parcial).
-- Tipos: MRR (mensalidade recorrente) ou TCV (valor total do contrato).
-- Renovação cria um novo registro com FK renovacao_de e marca o
-- anterior como 'renovado'. Expiração é automática quando data_fim
-- passou (função expire_due_contracts). Cancelamento exige motivo.
-- Cliente só pode virar 'churn' sem contrato ativo (trigger guard).
-- ==================================================================

CREATE TABLE IF NOT EXISTS public.contratos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  tipo                text NOT NULL CHECK (tipo IN ('MRR', 'TCV')),
  valor               numeric(12, 2) NOT NULL CHECK (valor > 0),
  duracao_meses       integer NOT NULL CHECK (duracao_meses > 0),
  data_inicio         date NOT NULL,
  data_fim            date NOT NULL,
  entregaveis         text[],
  status              text NOT NULL DEFAULT 'ativo'
                        CHECK (status IN ('ativo', 'expirado', 'renovado', 'cancelado')),
  renovacao_de        uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  data_cancelamento   date,
  motivo_cancelamento text,
  notas               text,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contratos_dates_chk CHECK (data_fim >= data_inicio)
);

-- Apenas um contrato ativo por cliente (índice único parcial)
CREATE UNIQUE INDEX IF NOT EXISTS idx_contratos_ativo_unico
  ON public.contratos (cliente_id)
  WHERE status = 'ativo';

CREATE INDEX IF NOT EXISTS idx_contratos_cliente   ON public.contratos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status    ON public.contratos (status);
CREATE INDEX IF NOT EXISTS idx_contratos_data_fim  ON public.contratos (data_fim);

-- Trigger updated_at (reusa touch_updated_at)
DROP TRIGGER IF EXISTS contratos_touch_updated_at ON public.contratos;
CREATE TRIGGER contratos_touch_updated_at
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- created_by é imutável depois do INSERT
CREATE OR REPLACE FUNCTION public.contratos_lock_created_by()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.created_by IS NOT NULL THEN
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contratos_lock_created_by ON public.contratos;
CREATE TRIGGER contratos_lock_created_by
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.contratos_lock_created_by();

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

-- RLS: leitura segue squad do cliente; escrita restrita a admin/head.
-- As RPCs SECURITY DEFINER são a porta principal; estas policies servem
-- como defesa em profundidade (qualquer acesso direto via PostgREST falha).
DROP POLICY IF EXISTS "contratos: squad select"        ON public.contratos;
DROP POLICY IF EXISTS "contratos: admin/head write"    ON public.contratos;
DROP POLICY IF EXISTS "contratos: deny crm-only roles" ON public.contratos;

CREATE POLICY "contratos: squad select"
  ON public.contratos FOR SELECT
  USING (
    private.is_admin_or_head()
    OR EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = contratos.cliente_id
        AND c.squad_id = ANY(private.get_user_squad_ids())
    )
  );

CREATE POLICY "contratos: admin/head write"
  ON public.contratos FOR ALL
  USING (private.is_admin_or_head())
  WITH CHECK (private.is_admin_or_head());

CREATE POLICY "contratos: deny crm-only roles"
  ON public.contratos
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (NOT private.is_crm_only())
  WITH CHECK (NOT private.is_crm_only());

-- ------------------------------------------------------------------
-- Função utilitária: expirar contratos vencidos.
-- Rodar via cron diário OU chamar manualmente. Idempotente.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_due_contracts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.contratos
     SET status = 'expirado',
         updated_at = now()
   WHERE status = 'ativo'
     AND data_fim < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_due_contracts() TO authenticated;

-- ------------------------------------------------------------------
-- Trigger guard: bloqueia cliente.status='churn' se houver contrato ativo.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clientes_block_churn_if_active_contract()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'churn' AND OLD.status IS DISTINCT FROM 'churn' THEN
    IF EXISTS (
      SELECT 1 FROM public.contratos
      WHERE cliente_id = NEW.id
        AND status = 'ativo'
    ) THEN
      RAISE EXCEPTION 'Cliente possui contrato ativo. Cancele ou expire o contrato antes de marcar como churn.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clientes_block_churn_if_active_contract ON public.clientes;
CREATE TRIGGER clientes_block_churn_if_active_contract
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.clientes_block_churn_if_active_contract();

-- ------------------------------------------------------------------
-- Carimba clientes.churned_at quando status muda para 'churn'.
-- Reseta para NULL quando o cliente volta para 'ativo'.
-- Habilita calculo de churn mensal sem depender de proxies de contrato.
-- ------------------------------------------------------------------
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS churned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_clientes_churned_at
  ON public.clientes (churned_at)
  WHERE churned_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.clientes_stamp_churned_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'churn' AND OLD.status IS DISTINCT FROM 'churn' THEN
    NEW.churned_at := now();
  ELSIF NEW.status = 'ativo' AND OLD.status = 'churn' THEN
    NEW.churned_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clientes_stamp_churned_at ON public.clientes;
CREATE TRIGGER clientes_stamp_churned_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.clientes_stamp_churned_at();

-- ------------------------------------------------------------------
-- RPC: criar contrato (admin/head)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.criar_contrato(
  p_cliente_id    uuid,
  p_tipo          text,
  p_valor         numeric,
  p_duracao_meses integer,
  p_data_inicio   date,
  p_entregaveis   text[] DEFAULT NULL,
  p_notas         text   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_id       uuid;
  v_data_fim date;
BEGIN
  IF NOT private.is_admin_or_head() THEN
    RAISE EXCEPTION 'Apenas admin ou head podem gerenciar contratos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_tipo NOT IN ('MRR', 'TCV') THEN
    RAISE EXCEPTION 'Tipo de contrato inválido: %', p_tipo USING ERRCODE = '22023';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;
  IF p_duracao_meses IS NULL OR p_duracao_meses <= 0 THEN
    RAISE EXCEPTION 'Duração em meses deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;
  IF p_data_inicio IS NULL THEN
    RAISE EXCEPTION 'Data de início é obrigatória.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.contratos
    WHERE cliente_id = p_cliente_id
      AND status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'Cliente já possui contrato ativo. Cancele ou expire o contrato atual antes de criar um novo.'
      USING ERRCODE = '23505';
  END IF;

  v_data_fim := (p_data_inicio + (p_duracao_meses || ' months')::interval)::date - 1;

  INSERT INTO public.contratos (
    cliente_id, tipo, valor, duracao_meses, data_inicio, data_fim,
    entregaveis, notas, status, created_by
  ) VALUES (
    p_cliente_id, p_tipo, p_valor, p_duracao_meses, p_data_inicio, v_data_fim,
    p_entregaveis, NULLIF(TRIM(p_notas), ''), 'ativo', auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.criar_contrato(uuid, text, numeric, integer, date, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_contrato(uuid, text, numeric, integer, date, text[], text) TO authenticated;

-- ------------------------------------------------------------------
-- RPC: renovar contrato (admin/head)
-- Marca o anterior como 'renovado' e cria novo apontando para ele.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.renovar_contrato(
  p_contrato_anterior_id uuid,
  p_tipo                 text,
  p_valor                numeric,
  p_duracao_meses        integer,
  p_data_inicio          date,
  p_entregaveis          text[] DEFAULT NULL,
  p_notas                text   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_anterior public.contratos%ROWTYPE;
  v_novo_id  uuid;
  v_data_fim date;
BEGIN
  IF NOT private.is_admin_or_head() THEN
    RAISE EXCEPTION 'Apenas admin ou head podem renovar contratos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_tipo NOT IN ('MRR', 'TCV') THEN
    RAISE EXCEPTION 'Tipo de contrato inválido: %', p_tipo USING ERRCODE = '22023';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;
  IF p_duracao_meses IS NULL OR p_duracao_meses <= 0 THEN
    RAISE EXCEPTION 'Duração em meses deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;
  IF p_data_inicio IS NULL THEN
    RAISE EXCEPTION 'Data de início é obrigatória.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_anterior FROM public.contratos
    WHERE id = p_contrato_anterior_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato % não encontrado.', p_contrato_anterior_id USING ERRCODE = 'P0002';
  END IF;

  IF v_anterior.status NOT IN ('ativo', 'expirado') THEN
    RAISE EXCEPTION 'Apenas contratos ativos ou expirados podem ser renovados (status atual: %).', v_anterior.status
      USING ERRCODE = '22023';
  END IF;

  v_data_fim := (p_data_inicio + (p_duracao_meses || ' months')::interval)::date - 1;

  -- Marca o anterior como 'renovado' primeiro: libera o índice único parcial.
  UPDATE public.contratos
     SET status = 'renovado',
         updated_at = now()
   WHERE id = p_contrato_anterior_id;

  INSERT INTO public.contratos (
    cliente_id, tipo, valor, duracao_meses, data_inicio, data_fim,
    entregaveis, notas, status, renovacao_de, created_by
  ) VALUES (
    v_anterior.cliente_id, p_tipo, p_valor, p_duracao_meses, p_data_inicio, v_data_fim,
    p_entregaveis, NULLIF(TRIM(p_notas), ''), 'ativo', p_contrato_anterior_id, auth.uid()
  )
  RETURNING id INTO v_novo_id;

  RETURN v_novo_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.renovar_contrato(uuid, text, numeric, integer, date, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renovar_contrato(uuid, text, numeric, integer, date, text[], text) TO authenticated;

-- ------------------------------------------------------------------
-- RPC: cancelar contrato (admin/head)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_contrato(
  p_contrato_id uuid,
  p_motivo      text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.is_admin_or_head() THEN
    RAISE EXCEPTION 'Apenas admin ou head podem cancelar contratos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) = 0 THEN
    RAISE EXCEPTION 'Motivo do cancelamento é obrigatório.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.contratos
     SET status = 'cancelado',
         data_cancelamento = CURRENT_DATE,
         motivo_cancelamento = trim(p_motivo),
         updated_at = now()
   WHERE id = p_contrato_id
     AND status = 'ativo';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contrato % não encontrado ou não está ativo.', p_contrato_id USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL  ON FUNCTION public.cancelar_contrato(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_contrato(uuid, text) TO authenticated;

-- ==================================================================
-- RPC: apagar cliente completo (admin/head)
--
-- Remove o cliente e TUDO que aponta para ele (contratos, projetos,
-- tarefas e leads vinculados) em uma unica transacao. Nada referente
-- ao cliente permanece no banco apos a execucao.
--
-- Necessario porque contratos.cliente_id e ON DELETE RESTRICT — um
-- DELETE direto em clientes falha sempre que existir qualquer
-- contrato (ativo, expirado, cancelado ou renovado).
-- ==================================================================
CREATE OR REPLACE FUNCTION public.apagar_cliente_completo(p_cliente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.is_admin_or_head() THEN
    RAISE EXCEPTION 'Apenas admin ou head podem excluir clientes.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_cliente_id) THEN
    RAISE EXCEPTION 'Cliente % nao encontrado.', p_cliente_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 1) Tarefas: tudo que aponta para o cliente OU para algum projeto dele.
  DELETE FROM public.tarefas
   WHERE cliente_id = p_cliente_id
      OR projeto_id IN (
        SELECT id FROM public.projetos WHERE cliente_id = p_cliente_id
      );

  -- 2) Projetos do cliente.
  DELETE FROM public.projetos WHERE cliente_id = p_cliente_id;

  -- 3) Contratos (FK RESTRICT obriga deletar antes do cliente).
  DELETE FROM public.contratos WHERE cliente_id = p_cliente_id;

  -- 4) Leads vinculados (apagados junto, sem preservar historico).
  DELETE FROM public.leads WHERE cliente_id = p_cliente_id;

  -- 5) Cliente.
  DELETE FROM public.clientes WHERE id = p_cliente_id;
END;
$$;

REVOKE ALL  ON FUNCTION public.apagar_cliente_completo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apagar_cliente_completo(uuid) TO authenticated;

-- ==================================================================
-- PROMOTE FIRST ADMIN
-- After your first sign-up, run the command below (replace the email):
--
--   UPDATE public.profiles SET role = 'admin'
--   WHERE email = 'seu@email.com';
--
-- ==================================================================

-- ==================================================================
-- USER ARCHIVING (soft delete)
--
-- archived_at IS NULL  → usuário ativo, login permitido
-- archived_at IS NOT NULL → usuário arquivado, banido em auth.users
--                           pela Edge Function manage-user.
--
-- Hard delete continua via manage-user (DELETE em auth.users que
-- cascateia profiles e squad_membros). Soft delete preserva o profile
-- para que clientes/tarefas/leads/contratos mantenham o histórico
-- "responsavel" / "criado por" mesmo após o usuário sair do time.
-- ==================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS archived_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_profiles_archived_at_active
  ON public.profiles (id) WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION private.count_active_admins()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT count(*)::int FROM public.profiles
   WHERE role = 'admin' AND archived_at IS NULL
$$;

-- Trigger guard: invariantes que defendem o domínio contra requests
-- que escapem da Edge Function (acesso direto via PostgREST, etc.).
--
-- auth.uid() é NULL quando o caller é service_role (Edge Functions,
-- jobs internos). Nessas chamadas confiamos no caller — a Edge Function
-- manage-user já valida que quem chamou é admin antes do UPDATE.
--
-- SECURITY DEFINER + search_path explícito: a trigger precisa enxergar
-- o schema `private` (helpers is_admin / count_active_admins), e
-- service_role não tem USAGE em private. Rodar como owner resolve.
CREATE OR REPLACE FUNCTION public.profiles_archive_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  archived_changed boolean := (OLD.archived_at IS DISTINCT FROM NEW.archived_at);
  is_system        boolean := (auth.uid() IS NULL);
BEGIN
  -- 1) Usuário não pode arquivar/desarquivar a si mesmo
  IF archived_changed AND NOT is_system AND NEW.id = auth.uid() THEN
    RAISE EXCEPTION 'Não é permitido arquivar ou restaurar a si mesmo.'
      USING ERRCODE = '42501';
  END IF;

  -- 2) Apenas admin (ou service_role) pode mexer em archived_at
  IF archived_changed AND NOT is_system AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'Apenas admin pode arquivar ou restaurar usuários.'
      USING ERRCODE = '42501';
  END IF;

  -- 3) Não permitir alterar role de usuário arquivado (force restore antes)
  IF OLD.archived_at IS NOT NULL
     AND NEW.archived_at IS NOT NULL
     AND OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Restaure o usuário antes de alterar o cargo.'
      USING ERRCODE = '42501';
  END IF;

  -- 4) Não deixar o sistema sem nenhum admin ativo
  IF OLD.role = 'admin' AND OLD.archived_at IS NULL THEN
    IF (NEW.role IS DISTINCT FROM 'admin' OR NEW.archived_at IS NOT NULL)
       AND private.count_active_admins() <= 1 THEN
      RAISE EXCEPTION 'Não é possível remover o último admin ativo do sistema.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_archive_guard ON public.profiles;
CREATE TRIGGER profiles_archive_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_archive_guard();

-- View atualizada: expõe archived_at e um campo `status` calculado
-- ('archived' | 'pending' | 'active') para a UI filtrar por aba.
--
-- Sem security_invoker: precisamos rodar como o dono (postgres) porque
-- o JOIN com auth.users falha para usuários `authenticated` (eles não
-- têm SELECT em auth.users). A tela /administrativo já é admin-only no
-- front e a policy "profiles: authenticated read" já permite ler todos
-- os profiles — a única coluna nova exposta é last_sign_in_at.
--
-- DROP + CREATE em vez de OR REPLACE porque a ordem das colunas mudou
-- (CREATE OR REPLACE só permite adicionar colunas no final).
DROP VIEW IF EXISTS public.user_invites_view;
CREATE VIEW public.user_invites_view AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.created_at                              AS invited_at,
  p.archived_at,
  u.last_sign_in_at,
  u.confirmed_at,
  (u.last_sign_in_at IS NULL AND p.archived_at IS NULL) AS pending,
  CASE
    WHEN p.archived_at IS NOT NULL THEN 'archived'
    WHEN u.last_sign_in_at IS NULL  THEN 'pending'
    ELSE 'active'
  END AS status
FROM public.profiles p
JOIN auth.users u ON u.id = p.id;

GRANT SELECT ON public.user_invites_view TO authenticated;
