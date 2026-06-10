-- ==================================================================
-- Adiciona o papel 'Filmmaker' ao CHECK da coluna profiles.role.
--
-- Filmmaker = produção de vídeo. Acesso (controlado no frontend): Visão Geral,
-- Calendário, Tarefas (dos squads que participa) e Squads (somente leitura,
-- só os que participa). A RLS existente já comporta o papel: não é crm-only
-- nem own-tasks-only, então cai no acesso por squad (private.get_user_squad_ids).
-- Idempotente.
-- ==================================================================
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'social media', 'closer', 'sdr', 'bdr', 'head', 'editor', 'dev', 'tv', 'Filmmaker'));
