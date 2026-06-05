-- LEADS — permitir que um admin seja responsavel pelo atendimento de um lead.
--
-- Antes, o trigger leads_atendimento_guard() so aceitava 'sdr'/'bdr' como
-- responsavel e levantava excecao para qualquer outro papel. Aqui passamos a
-- aceitar 'admin' tambem, para que um admin possa "assumir" um lead (no web e
-- no mobile). O RLS ja permitia ao admin atualizar a linha; o unico bloqueio
-- era este guard. Demais comportamentos (auto-virar em_atendimento, exigir
-- responsavel, carimbar atendimento_iniciado_em) ficam inalterados.

CREATE OR REPLACE FUNCTION public.leads_atendimento_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  responsavel_role text;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.responsavel_id IS NOT NULL
     AND NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
     AND NEW.status = 'pendente' THEN
    NEW.status := 'em_atendimento';
  END IF;

  IF NEW.status = 'em_atendimento' AND NEW.responsavel_id IS NULL THEN
    RAISE EXCEPTION 'em_atendimento requires a responsavel';
  END IF;

  IF NEW.responsavel_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id) THEN
    SELECT role INTO responsavel_role
      FROM public.profiles
      WHERE id = NEW.responsavel_id;
    IF responsavel_role NOT IN ('sdr', 'bdr', 'admin') THEN
      RAISE EXCEPTION 'responsavel must have role sdr, bdr or admin';
    END IF;
  END IF;

  IF NEW.status = 'em_atendimento'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'em_atendimento') THEN
    NEW.atendimento_iniciado_em := now();
  ELSIF NEW.status <> 'em_atendimento' THEN
    NEW.atendimento_iniciado_em := NULL;
  END IF;

  RETURN NEW;
END;
$function$;
