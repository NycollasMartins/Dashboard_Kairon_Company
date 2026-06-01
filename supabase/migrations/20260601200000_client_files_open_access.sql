-- ==================================================================
-- ARQUIVOS DO CLIENTE — acesso ABERTO
-- Qualquer usuário autenticado pode ver, adicionar e remover
-- arquivos/pastas (substitui a regra por squad de can_access_cliente).
-- Idempotente.
-- ==================================================================

-- client_folders ---------------------------------------------------
DROP POLICY IF EXISTS "client_folders: access read"        ON public.client_folders;
DROP POLICY IF EXISTS "client_folders: access manage"      ON public.client_folders;
DROP POLICY IF EXISTS "client_folders: authenticated read"   ON public.client_folders;
DROP POLICY IF EXISTS "client_folders: authenticated manage" ON public.client_folders;

CREATE POLICY "client_folders: authenticated read"
  ON public.client_folders FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "client_folders: authenticated manage"
  ON public.client_folders FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- client_files -----------------------------------------------------
DROP POLICY IF EXISTS "client_files: access read"          ON public.client_files;
DROP POLICY IF EXISTS "client_files: access manage"        ON public.client_files;
DROP POLICY IF EXISTS "client_files: authenticated read"     ON public.client_files;
DROP POLICY IF EXISTS "client_files: authenticated manage"   ON public.client_files;

CREATE POLICY "client_files: authenticated read"
  ON public.client_files FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "client_files: authenticated manage"
  ON public.client_files FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- storage.objects (bucket client-files) ----------------------------
DROP POLICY IF EXISTS "client-files: read"   ON storage.objects;
DROP POLICY IF EXISTS "client-files: insert" ON storage.objects;
DROP POLICY IF EXISTS "client-files: update" ON storage.objects;
DROP POLICY IF EXISTS "client-files: delete" ON storage.objects;

CREATE POLICY "client-files: read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'client-files');
CREATE POLICY "client-files: insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'client-files');
CREATE POLICY "client-files: update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'client-files')
  WITH CHECK (bucket_id = 'client-files');
CREATE POLICY "client-files: delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'client-files');
