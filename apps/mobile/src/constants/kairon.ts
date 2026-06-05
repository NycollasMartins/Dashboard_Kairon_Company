// Tokens visuais do Kairon Company (dark theme forcado), espelhando a paleta do
// app web (#EA3935 / #C12D29 + fundo #0d0d0d). Estilizacao via StyleSheet nativo.

export const Kairon = {
  bg: '#0d0d0d',
  bgElevated: '#161616',
  card: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
  primary: '#EA3935',
  primaryDark: '#C12D29',
  text: '#ffffff',
  textMuted: '#9ca3af',
  // cores de status / prioridade
  slate: '#94a3b8',
  blue: '#60a5fa',
  yellow: '#facc15',
  emerald: '#34d399',
  red: '#f87171',
} as const;

export type TarefaStatus = 'pendente' | 'em_andamento' | 'revisao' | 'concluida';
export type TarefaPrioridade = 'baixa' | 'media' | 'alta' | 'urgente';

export const STATUS_CONFIG: Record<TarefaStatus, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: Kairon.slate },
  em_andamento: { label: 'Em Andamento', color: Kairon.blue },
  revisao: { label: 'Revisão', color: Kairon.yellow },
  concluida: { label: 'Concluída', color: Kairon.emerald },
};

export const STATUS_ORDER: TarefaStatus[] = ['pendente', 'em_andamento', 'revisao', 'concluida'];

export const PRIORIDADE_CONFIG: Record<TarefaPrioridade, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: Kairon.slate },
  media: { label: 'Média', color: Kairon.blue },
  alta: { label: 'Alta', color: Kairon.red },
  urgente: { label: 'Urgente', color: Kairon.red },
};

export type EventoTipo = 'meeting' | 'activity' | 'delivery';

export const EVENTO_TIPO_CONFIG: Record<EventoTipo, { label: string; color: string }> = {
  meeting: { label: 'Reunião', color: Kairon.blue },
  activity: { label: 'Atividade', color: Kairon.yellow },
  delivery: { label: 'Entrega', color: Kairon.emerald },
};

export type EventoAudiencia = 'all' | 'squad' | 'user';

export const EVENTO_AUDIENCIA_CONFIG: Record<EventoAudiencia, { label: string }> = {
  all: { label: 'Todos' },
  squad: { label: 'Um squad' },
  user: { label: 'Uma pessoa' },
};
