-- ==================================================================
-- Alinha o CHECK de profiles.role com TODOS os papéis oferecidos na UI
-- (roleConfig): acrescenta 'designer' e 'cs', que existiam no frontend e na
-- RLS, mas nunca tinham sido adicionados à constraint — convidar um usuário
-- como Designer (ou CS) violava profiles_role_check.
-- Idempotente.
-- ==================================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'social media', 'closer', 'sdr', 'bdr', 'head', 'editor', 'dev', 'tv', 'cs', 'designer', 'Filmmaker'));
