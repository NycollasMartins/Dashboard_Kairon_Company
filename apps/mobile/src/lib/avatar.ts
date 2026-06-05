// Avatar helpers compartilhados pelos cards de lead. As iniciais espelham o web
// (LeadCard.jsx); a cor do circulo segue a etapa do lead (LEAD_STATUS_CONFIG).

/** Iniciais (1-2 letras) de um nome. */
export function initialsOf(name = ''): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
