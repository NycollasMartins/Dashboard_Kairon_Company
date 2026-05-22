-- =============================================================
-- Trigger: cria automaticamente um projeto "Onboarding"
-- + 4 tarefas iniciais atribuidas ao Gabriel Arlindo
-- toda vez que um novo cliente e cadastrado.
--
-- Rode este arquivo INTEIRO no Supabase SQL Editor.
-- E idempotente: pode ser executado varias vezes sem erro.
-- =============================================================

DROP TRIGGER IF EXISTS on_cliente_created_onboarding ON public.clientes;

CREATE OR REPLACE FUNCTION public.handle_new_cliente_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto_id uuid;
  v_gabriel_id uuid;
BEGIN
  SELECT id INTO v_gabriel_id
    FROM public.profiles
    WHERE email = 'batistagabriel095@gmail.com'
    LIMIT 1;
  -- Se Gabriel ainda nao existe no banco, segue sem responsavel.
  -- Tarefas ficam com responsavel_id = NULL para serem atribuidas depois.

  INSERT INTO public.projetos (nome, descricao, status, cliente_id)
  VALUES (
    'Onboarding',
    'Jornada de entrada do cliente na Kairon.',
    'ativo',
    NEW.id
  )
  RETURNING id INTO v_projeto_id;

  INSERT INTO public.tarefas (titulo, status, prioridade, responsavel_id, cliente_id, projeto_id)
  VALUES
    ('Preencher Info de Contrato',  'pendente', 'media', v_gabriel_id, NEW.id, v_projeto_id),
    ('Reuniao Welcome',             'pendente', 'media', v_gabriel_id, NEW.id, v_projeto_id),
    ('Mandar Checklist de Acesso',  'pendente', 'media', v_gabriel_id, NEW.id, v_projeto_id),
    ('Reuniao Kickoff',             'pendente', 'media', v_gabriel_id, NEW.id, v_projeto_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_cliente_created_onboarding
  AFTER INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_cliente_onboarding();
