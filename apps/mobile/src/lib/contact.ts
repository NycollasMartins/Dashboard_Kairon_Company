// Acoes de contato direto com o lead a partir do app (discador / WhatsApp).
import { Linking } from 'react-native';

/** Mantem apenas digitos do telefone (remove (), -, espacos, +). */
function digitsOf(telefone: string): string {
  return telefone.replace(/\D/g, '');
}

/**
 * Garante DDI 55 (Brasil) no numero. Numeros locais (10-11 digitos) recebem o
 * prefixo; numeros que ja vem com DDI sao mantidos.
 */
function withCountryCode(digits: string): string {
  if (!digits) return digits;
  return digits.startsWith('55') && digits.length > 11 ? digits : `55${digits}`;
}

/** Abre o discador nativo com o numero do lead. */
export function callPhone(telefone?: string | null): void {
  const digits = digitsOf(telefone ?? '');
  if (!digits) return;
  Linking.openURL(`tel:${digits}`);
}

/**
 * Abre a conversa no WhatsApp. Tenta o esquema nativo e cai no link web (wa.me)
 * caso o app nao esteja instalado.
 */
export async function openWhatsApp(telefone?: string | null): Promise<void> {
  const phone = withCountryCode(digitsOf(telefone ?? ''));
  if (!phone) return;
  const appUrl = `whatsapp://send?phone=${phone}`;
  const webUrl = `https://wa.me/${phone}`;
  try {
    const canOpen = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpen ? appUrl : webUrl);
  } catch {
    await Linking.openURL(webUrl);
  }
}
