// Tipos leves das entidades consumidas do @kairon/core (que e JS puro).
// Cobrem apenas os campos usados pelas telas do MVP.
import type { TarefaPrioridade, TarefaStatus } from '@/constants/kairon';

export type Tarefa = {
  id: string;
  titulo: string;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  prazo: string | null;
  responsavel_id: string | null;
  projeto_id: string | null;
  cliente_id: string | null;
  clientes?: { nome?: string; status?: string } | null;
  projetos?: { nome?: string } | null;
};

export type Projeto = {
  id: string;
  nome: string;
  status: string;
  prazo: string | null;
  cliente_id: string | null;
  clientes?: { nome?: string } | null;
};

export type Evento = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  location: string | null;
  assignee_id: string | null;
  squad_id: string | null;
  assignee?: { full_name?: string; email?: string } | null;
  squad?: { nome?: string } | null;
};
