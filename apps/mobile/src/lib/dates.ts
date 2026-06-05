// Helpers de data alinhados ao web (comparacao por string YYYY-MM-DD).
export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function isAtrasada(prazo: string | null): boolean {
  return !!prazo && prazo < getTodayStr();
}

export function isVencendoHoje(prazo: string | null): boolean {
  return prazo === getTodayStr();
}

export function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export const WEEKDAYS_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
export const WEEKDAYS_TITLE = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WEEKDAYS_LONG = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];
export const MONTHS_LONG = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** Data local no formato YYYY-MM-DD (sem deslocamento de fuso, ao contrario de toISOString). */
export function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Dia local (YYYY-MM-DD) de um timestamp ISO (ex.: start_at de um evento). */
export function isoToLocalDay(isoTimestamp: string): string {
  return localISO(new Date(isoTimestamp));
}

/** Hora local HH:mm de um timestamp ISO. */
export function timeHM(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Tempo decorrido em formato curto (agora / 2h / 5d / 1sem), igual ao web (LeadCard.jsx). */
export function relativeShort(iso?: string | null): string | null {
  if (!iso) return null;
  const diffH = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
  if (diffH < 1) return 'agora';
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return `${Math.floor(diffD / 7)}sem`;
}
