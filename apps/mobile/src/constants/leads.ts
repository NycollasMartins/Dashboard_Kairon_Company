// Etapas do pipeline comercial, espelhando as colunas do Kanban web
// (apps/web/src/features/comercial). As 4 primeiras sao as etapas visiveis no
// pipeline; 'perdido' existe para rotulo/cor mas e filtrado da lista.
import { Kairon } from '@/constants/kairon';

export type LeadStatus =
  | 'pendente'
  | 'em_atendimento'
  | 'follow_up'
  | 'reuniao_marcada'
  | 'perdido';

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: Kairon.slate },
  em_atendimento: { label: 'Em Atendimento', color: Kairon.blue },
  follow_up: { label: 'Follow Up', color: Kairon.yellow },
  reuniao_marcada: { label: 'Reunião Marcada', color: Kairon.emerald },
  perdido: { label: 'Perdido', color: Kairon.red },
};

// Ordem das secoes no pipeline mobile (cada uma equivale a uma coluna do Kanban).
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'pendente',
  'em_atendimento',
  'follow_up',
  'reuniao_marcada',
];

// Etapas do bloco "Em andamento" (pipeline sem os leads novos/pendentes), que
// evoluem ao longo de dias — separadas dos leads novos, que exigem acao imediata.
export const LEAD_STATUS_ANDAMENTO: LeadStatus[] = ['em_atendimento', 'follow_up', 'reuniao_marcada'];

// Papeis que enxergam a tab Comercial / o CRM (espelha o gate do web).
export const ROLES_COMERCIAL = ['admin', 'closer', 'sdr', 'bdr'];

// SLA de primeiro atendimento (10 min), igual ao web (LeadCard.jsx).
export const SLA_MS = 10 * 60 * 1000;

/** Normaliza origem do lead para um rotulo curto, igual ao web. */
export function origemLabel(origem?: string | null): string {
  if (origem === 'inbound' || origem === 'landing_page') return 'Inbound';
  if (origem === 'outbound' || origem === 'manual') return 'Outbound';
  return origem || '—';
}
