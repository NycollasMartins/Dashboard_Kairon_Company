-- ==================================================================
-- PERFIL DO USUÁRIO: foto + preferências (idioma/moeda/tema)
-- Idempotente.
-- ==================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url  text,
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

-- O usuário atualiza o PRÓPRIO avatar/preferências via a policy já existente
-- "profiles: self update" (id = auth.uid()).

-- ------------------------------------------------------------------
-- STORAGE: bucket público 'avatars' (foto de perfil)
-- Path = <user_id>/<arquivo>. Leitura pública; escrita só na própria pasta.
-- ------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('avatars', 'avatars', true, 5242880)   -- 5 MB
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "avatars: public read"  ON storage.objects;
DROP POLICY IF EXISTS "avatars: own insert"   ON storage.objects;
DROP POLICY IF EXISTS "avatars: own update"   ON storage.objects;
DROP POLICY IF EXISTS "avatars: own delete"   ON storage.objects;

CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars: own insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars: own update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars: own delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
