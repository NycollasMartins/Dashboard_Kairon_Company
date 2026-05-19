-- =============================================================
-- Trigger: cria automaticamente um projeto "Backlog"
-- toda vez que um novo cliente e cadastrado.
--
-- Rode este arquivo INTEIRO no Supabase SQL Editor.
-- E idempotente: pode ser executado varias vezes sem erro.
-- =============================================================

-- 1) Remove trigger antigo (se existir) ANTES de mexer na funcao,
--    para evitar estado orfao (trigger apontando para funcao inexistente).
DROP TRIGGER IF EXISTS on_cliente_created_backlog ON public.clientes;

-- 2) Cria/atualiza a funcao. Mesmo padrao de public.handle_new_user().
CREATE OR REPLACE FUNCTION public.handle_new_cliente_backlog()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.projetos (nome, descricao, status, cliente_id)
  VALUES (
    'Backlog',
    'Projeto padrao para itens sem projeto formal.',
    'ativo',
    NEW.id
  );
  RETURN NEW;
END;
$$;

-- 3) Recria o trigger apontando para a funcao recem-criada.
CREATE TRIGGER on_cliente_created_backlog
  AFTER INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_cliente_backlog();
