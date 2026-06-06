-- ==================================================================
-- Leads: corrige a CHECK constraint de `origem`.
--
-- Bug: a função create_lead_from_webhook usa default p_origem = 'inbound'
-- e o modal "Nova Lead" do dashboard oferece a opção "Inbound", mas
-- leads_origem_check NÃO incluía 'inbound'. Resultado: quando o webhook
-- da Landing Page não envia `origem` (ou alguém cria lead "Inbound" no
-- painel), o INSERT viola a constraint e o lead é perdido — não chega na
-- pipeline.
--
-- Fix: recria a constraint incluindo 'inbound' (mantendo os demais valores
-- já usados pelo app/CRM). Idempotente.
-- ==================================================================

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_origem_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_origem_check
  CHECK (origem = ANY (ARRAY[
    'inbound',
    'outbound',
    'landing_page',
    'manual',
    'indicacao',
    'google_ads',
    'instagram',
    'facebook',
    'outro'
  ]));
