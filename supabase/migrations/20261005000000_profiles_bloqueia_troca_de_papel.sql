-- ==================================================================
-- SEGURANÇA — impede que um usuário altere o próprio papel (role/email)
--
-- Problema: a policy "profiles: self update" (schema.sql) libera UPDATE na
-- própria linha sem restringir colunas, e nenhum trigger barrava a troca de
-- `role`. Qualquer usuário logado conseguia se promover a admin com:
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', <meu id>)
--
-- Regra nova (trigger BEFORE UPDATE):
--   - `role` e `email` só mudam por ADMIN (private.is_strict_admin) ou por
--     contexto de sistema (auth.uid() IS NULL: service_role das Edge
--     Functions, SQL Editor, cron). O usuário segue podendo editar os demais
--     campos do próprio perfil (ex.: full_name).
--   - Não afeta: invite-user / manage-user (service_role), a troca de papel
--     na tela Membros (admin) nem o ajuste de papel feito por invitesApi
--     (executado pelo admin que convidou).
--
-- Idempotente.
-- ==================================================================

CREATE OR REPLACE FUNCTION public.profiles_identity_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
BEGIN
  -- Contexto de sistema (sem JWT de usuário): liberado.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admin estrito (não inclui 'dev') pode alterar papel e e-mail.
  -- A checagem lê o papel ATUAL do chamador (antes deste UPDATE), então um
  -- usuário comum não consegue se autopromover na mesma operação.
  IF private.is_strict_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Apenas admin pode alterar o papel de um usuário.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Apenas admin pode alterar o e-mail do perfil.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_identity_guard ON public.profiles;
CREATE TRIGGER profiles_identity_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_identity_guard();

-- Comentário da policy alinhado ao comportamento real.
COMMENT ON POLICY "profiles: self update" ON public.profiles IS
  'Usuário edita a própria linha. role/email protegidos pelo trigger profiles_identity_guard.';

-- ------------------------------------------------------------------
-- Verificação (rode logado como um usuário NÃO admin, ex. via app):
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', <id>)
--   -> deve falhar com "Apenas admin pode alterar o papel de um usuário."
--
-- Auditoria — usuários que hoje são admin (confira se todos são esperados):
--   SELECT id, email, full_name, created_at FROM public.profiles
--   WHERE role = 'admin' ORDER BY created_at;
-- ------------------------------------------------------------------
