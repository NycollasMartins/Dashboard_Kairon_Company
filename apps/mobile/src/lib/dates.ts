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
