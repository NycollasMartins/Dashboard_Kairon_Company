-- ==================================================================
-- SEGURANÇA — novos usuários entram SEM acesso até um admin definir o papel
--
-- Problema: handle_new_user() criava todo usuário novo com role = 'sdr', e
-- 'sdr' lê TODOS os leads (dados pessoais). O login web oferece Google/Apple
-- OAuth e auth.signUp é chamável com a anon key pública: se o signup estiver
-- habilitado no projeto, qualquer pessoa ganhava acesso a dados de clientes.
-- Além disso, várias tabelas liberavam leitura para QUALQUER autenticado.
--
-- O que esta migration faz:
--   1) Novo papel 'pendente' (sem acesso a dados) e default de profiles.role.
--   2) handle_new_user() passa a criar o perfil como 'pendente'.
--      O fluxo de convite NÃO muda: invite-user (service_role) grava o papel
--      real logo após o convite. Usuários existentes NÃO são alterados.
--   3) Helper private.is_member(): papel definido (≠ 'pendente') e não
--      arquivado.
--   4) Policies que liberavam leitura/escrita para "qualquer autenticado"
--      passam a exigir private.is_member(). O próprio perfil continua
--      legível (o app precisa dele para saber o papel).
--   5) user_invites_view (roda como owner, ignora RLS) passa a filtrar por
--      private.is_member().
--
-- Continua sendo recomendado DESLIGAR o signup público em
-- Authentication → Providers (o fluxo oficial é por convite).
--
-- Pré-requisito: 20261005000000_profiles_bloqueia_troca_de_papel.sql
-- (sem ele, um usuário 'pendente' poderia trocar o próprio papel).
-- Idempotente.
-- ==================================================================

-- 1) Papel 'pendente' -------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'social media', 'closer', 'sdr', 'bdr', 'head', 'editor',
                  'dev', 'tv', 'cs', 'designer', 'Filmmaker', 'pendente'));

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'pendente';

-- 2) Novo usuário nasce 'pendente' ------------------------------------
-- raw_user_meta_data é usado só para exibição (full_name), nunca para
-- autorização.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'pendente'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3) Helper: membro ativo ---------------------------------------------
CREATE OR REPLACE FUNCTION private.is_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role <> 'pendente'
      AND archived_at IS NULL
  )
$$;

-- 4) Policies abertas -> somente membros ------------------------------

-- profiles: membro lê todos; qualquer um lê o próprio perfil.
DROP POLICY IF EXISTS "profiles: authenticated read" ON public.profiles;
DROP POLICY IF EXISTS "profiles: member read"        ON public.profiles;
CREATE POLICY "profiles: member read"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR private.is_member());

-- squads / squad_membros
DROP POLICY IF EXISTS "squads: authenticated read" ON public.squads;
DROP POLICY IF EXISTS "squads: member read"        ON public.squads;
CREATE POLICY "squads: member read"
  ON public.squads FOR SELECT
  USING (private.is_member());

DROP POLICY IF EXISTS "squad_membros: authenticated read" ON public.squad_membros;
DROP POLICY IF EXISTS "squad_membros: member read"        ON public.squad_membros;
CREATE POLICY "squad_membros: member read"
  ON public.squad_membros FOR SELECT
  USING (private.is_member());

-- calendário
DROP POLICY IF EXISTS "calendar_events: authenticated read" ON public.calendar_events;
DROP POLICY IF EXISTS "calendar_events: member read"        ON public.calendar_events;
CREATE POLICY "calendar_events: member read"
  ON public.calendar_events FOR SELECT
  USING (private.is_member());

DROP POLICY IF EXISTS "event_attendees: authenticated read" ON public.event_attendees;
DROP POLICY IF EXISTS "event_attendees: member read"        ON public.event_attendees;
CREATE POLICY "event_attendees: member read"
  ON public.event_attendees FOR SELECT
  USING (private.is_member());

-- metas / vendas
DROP POLICY IF EXISTS "metas: authenticated read" ON public.metas;
DROP POLICY IF EXISTS "metas: member read"        ON public.metas;
CREATE POLICY "metas: member read"
  ON public.metas FOR SELECT
  USING (private.is_member());

DROP POLICY IF EXISTS "vendas: authenticated read" ON public.vendas;
DROP POLICY IF EXISTS "vendas: member read"        ON public.vendas;
CREATE POLICY "vendas: member read"
  ON public.vendas FOR SELECT
  USING (private.is_member());

-- arquivos de clientes (tabelas)
DROP POLICY IF EXISTS "client_folders: authenticated read"   ON public.client_folders;
DROP POLICY IF EXISTS "client_folders: authenticated manage" ON public.client_folders;
DROP POLICY IF EXISTS "client_folders: member read"          ON public.client_folders;
DROP POLICY IF EXISTS "client_folders: member manage"        ON public.client_folders;
CREATE POLICY "client_folders: member read"
  ON public.client_folders FOR SELECT
  USING (private.is_member());
CREATE POLICY "client_folders: member manage"
  ON public.client_folders FOR ALL
  USING (private.is_member())
  WITH CHECK (private.is_member());

DROP POLICY IF EXISTS "client_files: authenticated read"   ON public.client_files;
DROP POLICY IF EXISTS "client_files: authenticated manage" ON public.client_files;
DROP POLICY IF EXISTS "client_files: member read"          ON public.client_files;
DROP POLICY IF EXISTS "client_files: member manage"        ON public.client_files;
CREATE POLICY "client_files: member read"
  ON public.client_files FOR SELECT
  USING (private.is_member());
CREATE POLICY "client_files: member manage"
  ON public.client_files FOR ALL
  USING (private.is_member())
  WITH CHECK (private.is_member());

-- arquivos de clientes (storage.objects, bucket client-files)
DROP POLICY IF EXISTS "client-files: read"   ON storage.objects;
DROP POLICY IF EXISTS "client-files: insert" ON storage.objects;
DROP POLICY IF EXISTS "client-files: update" ON storage.objects;
DROP POLICY IF EXISTS "client-files: delete" ON storage.objects;
CREATE POLICY "client-files: read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-files' AND private.is_member());
CREATE POLICY "client-files: insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-files' AND private.is_member());
CREATE POLICY "client-files: update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-files' AND private.is_member())
  WITH CHECK (bucket_id = 'client-files' AND private.is_member());
CREATE POLICY "client-files: delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-files' AND private.is_member());

-- 5) user_invites_view: somente membros -------------------------------
-- Mesmas colunas da versão de schema.sql. DROP + CREATE porque versões
-- anteriores da view têm outra ordem de colunas. A view roda como owner
-- (precisa ler auth.users), então o filtro precisa estar nela:
-- private.is_member() avalia o auth.uid() de quem consulta.
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
JOIN auth.users u ON u.id = p.id
WHERE private.is_member();

GRANT SELECT ON public.user_invites_view TO authenticated;

-- ------------------------------------------------------------------
-- Verificação:
--   -- usuários aguardando aprovação
--   SELECT id, email, created_at FROM public.profiles WHERE role = 'pendente';
--
--   -- contas 'sdr' que nunca foram convidadas (possível signup aberto):
--   SELECT p.id, p.email, u.created_at, u.invited_at, u.raw_app_meta_data->>'provider' AS provider
--   FROM public.profiles p JOIN auth.users u ON u.id = p.id
--   WHERE p.role = 'sdr' AND u.invited_at IS NULL;
-- ------------------------------------------------------------------
