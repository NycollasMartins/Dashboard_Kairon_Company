-- ==================================================================
-- PUSH NOTIFICATIONS (mobile / Expo)
--  - tabela push_tokens (token Expo por dispositivo/usuário) + RLS
--  - nova NOTIFICATION => dispara push p/ os dispositivos do usuário
--    via Edge Function `push-fanout` (pg_net.http_post, assíncrono)
--
-- Reaproveita o sistema de notificações existente: como já há um gatilho
-- que insere uma linha em `public.notifications` por usuário a cada novo
-- lead (e evento/meta), pendurar o push em `notifications` cobre todos os
-- tipos de uma vez.
-- Idempotente.
-- ==================================================================

-- pg_net: HTTP assíncrono de dentro do Postgres (usado pelo gatilho).
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ------------------------------------------------------------------
-- Tokens de push (um por dispositivo). O app faz upsert no login.
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  platform    text,                              -- 'ios' | 'android'
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Cada usuário gerencia só os PRÓPRIOS tokens. A Edge Function lê todos
-- via service_role (ignora RLS).
DROP POLICY IF EXISTS "push_tokens: own read"   ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens: own insert" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens: own update" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens: own delete" ON public.push_tokens;
CREATE POLICY "push_tokens: own read"
  ON public.push_tokens FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "push_tokens: own insert"
  ON public.push_tokens FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_tokens: own update"
  ON public.push_tokens FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "push_tokens: own delete"
  ON public.push_tokens FOR DELETE USING (user_id = auth.uid());

-- Mantém updated_at em dia no upsert (reatribuição de token entre contas).
DROP TRIGGER IF EXISTS push_tokens_touch_updated_at ON public.push_tokens;
CREATE TRIGGER push_tokens_touch_updated_at
  BEFORE UPDATE ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ------------------------------------------------------------------
-- Nova NOTIFICATION => push para os dispositivos do usuário.
-- O gatilho chama a Edge Function `push-fanout` (assíncrono via pg_net),
-- mandando apenas o id. A função lê o conteúdo autoritativo da notificação
-- e busca os push_tokens do usuário (service_role).
-- O Bearer é a anon key (já pública no app) — só satisfaz o verify_jwt.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.notifications_push_fanout()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, net
AS $$
DECLARE
  v_url  text := 'https://tguefaugsocobaawoueq.supabase.co/functions/v1/push-fanout';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRndWVmYXVnc29jb2JhYXdvdWVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NDAyMTQsImV4cCI6MjA5NDExNjIxNH0.YAvUUx5298JSz-JcsVUGwDoD9rNncaGLDh2OMKbL6TY';
BEGIN
  PERFORM net.http_post(
    url     := v_url,
    body    := jsonb_build_object('notification_id', NEW.id),
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_anon
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_push_fanout ON public.notifications;
CREATE TRIGGER notifications_push_fanout
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION private.notifications_push_fanout();
