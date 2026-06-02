-- ==================================================================
-- DOCUMENTOS DE COLABORADORES (aba Membros) — somente admin.
-- Contratos/documentos por usuário, no bucket privado 'member-files'.
-- Idempotente.
-- ==================================================================

CREATE TABLE IF NOT EXISTS public.member_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          text NOT NULL,
  storage_path  text NOT NULL UNIQUE,
  mime_type     text,
  size_bytes    bigint,
  doc_type      text NOT NULL DEFAULT 'documento'
                  CHECK (doc_type IN ('contrato', 'documento')),
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_documents_profile ON public.member_documents (profile_id);

ALTER TABLE public.member_documents ENABLE ROW LEVEL SECURITY;

-- RLS — somente admin (estrito), igual à área de Membros/Administrativo.
DROP POLICY IF EXISTS "member_documents: admin read"   ON public.member_documents;
DROP POLICY IF EXISTS "member_documents: admin manage" ON public.member_documents;
CREATE POLICY "member_documents: admin read"
  ON public.member_documents FOR SELECT
  USING (private.is_strict_admin());
CREATE POLICY "member_documents: admin manage"
  ON public.member_documents FOR ALL
  USING (private.is_strict_admin())
  WITH CHECK (private.is_strict_admin());

-- ------------------------------------------------------------------
-- STORAGE: bucket privado 'member-files' (path = <profile_id>/<uuid>)
-- ------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('member-files', 'member-files', false, 209715200)   -- 200 MB
ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "member-files: read"   ON storage.objects;
DROP POLICY IF EXISTS "member-files: insert" ON storage.objects;
DROP POLICY IF EXISTS "member-files: update" ON storage.objects;
DROP POLICY IF EXISTS "member-files: delete" ON storage.objects;

CREATE POLICY "member-files: read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'member-files' AND private.is_strict_admin());
CREATE POLICY "member-files: insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'member-files' AND private.is_strict_admin());
CREATE POLICY "member-files: update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'member-files' AND private.is_strict_admin())
  WITH CHECK (bucket_id = 'member-files' AND private.is_strict_admin());
CREATE POLICY "member-files: delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'member-files' AND private.is_strict_admin());
