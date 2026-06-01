-- ==================================================================
-- ARQUIVOS DO CLIENTE (pastas aninhadas + arquivos no Supabase Storage)
--
-- - Bucket privado 'client-files' (acesso só por link assinado).
-- - Pastas (client_folders) com parent_id => aninhamento infinito.
-- - Arquivos (client_files) guardam apenas metadados; o binário fica
--   no Storage em <client_id>/<uuid>.
-- - Permissão: mesma regra de Clientes (membros do squad + admin/dev),
--   via private.can_access_cliente().
-- Idempotente.
-- ==================================================================

-- ------------------------------------------------------------------
-- Helper: usuário pode acessar este cliente? (espelha o acesso de clientes)
-- SECURITY DEFINER para não recursar na RLS de clientes.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.can_access_cliente(p_cliente_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT (NOT private.is_crm_only())
     AND EXISTS (
       SELECT 1 FROM public.clientes c
       WHERE c.id = p_cliente_id
         AND (c.squad_id = ANY(private.get_user_squad_ids()) OR private.is_admin())
     )
$$;

-- ------------------------------------------------------------------
-- TABELA: client_folders (pastas)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_folders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES public.clientes(id)        ON DELETE CASCADE,
  parent_id   uuid REFERENCES public.client_folders(id)           ON DELETE CASCADE,
  name        text NOT NULL,
  created_by  uuid REFERENCES public.profiles(id)                 ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_folders_client ON public.client_folders (client_id);
CREATE INDEX IF NOT EXISTS idx_client_folders_parent ON public.client_folders (parent_id);
ALTER TABLE public.client_folders ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS client_folders_touch_updated_at ON public.client_folders;
CREATE TRIGGER client_folders_touch_updated_at
  BEFORE UPDATE ON public.client_folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------------
-- TABELA: client_files (metadados; binário no Storage)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES public.clientes(id)       ON DELETE CASCADE,
  folder_id     uuid REFERENCES public.client_folders(id)          ON DELETE CASCADE,
  name          text NOT NULL,
  storage_path  text NOT NULL UNIQUE,
  mime_type     text,
  size_bytes    bigint,
  created_by    uuid REFERENCES public.profiles(id)                ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_files_client ON public.client_files (client_id);
CREATE INDEX IF NOT EXISTS idx_client_files_folder ON public.client_files (folder_id);
ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------
-- RLS — ler/gerenciar se pode acessar o cliente
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "client_folders: access read"   ON public.client_folders;
DROP POLICY IF EXISTS "client_folders: access manage" ON public.client_folders;
CREATE POLICY "client_folders: access read"
  ON public.client_folders FOR SELECT
  USING (private.can_access_cliente(client_id));
CREATE POLICY "client_folders: access manage"
  ON public.client_folders FOR ALL
  USING (private.can_access_cliente(client_id))
  WITH CHECK (private.can_access_cliente(client_id));

DROP POLICY IF EXISTS "client_files: access read"   ON public.client_files;
DROP POLICY IF EXISTS "client_files: access manage" ON public.client_files;
CREATE POLICY "client_files: access read"
  ON public.client_files FOR SELECT
  USING (private.can_access_cliente(client_id));
CREATE POLICY "client_files: access manage"
  ON public.client_files FOR ALL
  USING (private.can_access_cliente(client_id))
  WITH CHECK (private.can_access_cliente(client_id));

-- ------------------------------------------------------------------
-- STORAGE: bucket privado + policies (path = <client_id>/<uuid>)
-- ------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('client-files', 'client-files', false, 5368709120)   -- 5 GB por arquivo
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "client-files: read"   ON storage.objects;
DROP POLICY IF EXISTS "client-files: insert" ON storage.objects;
DROP POLICY IF EXISTS "client-files: update" ON storage.objects;
DROP POLICY IF EXISTS "client-files: delete" ON storage.objects;

CREATE POLICY "client-files: read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-files'
    AND private.can_access_cliente(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "client-files: insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-files'
    AND private.can_access_cliente(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "client-files: update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-files'
    AND private.can_access_cliente(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'client-files'
    AND private.can_access_cliente(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "client-files: delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-files'
    AND private.can_access_cliente(((storage.foldername(name))[1])::uuid)
  );
