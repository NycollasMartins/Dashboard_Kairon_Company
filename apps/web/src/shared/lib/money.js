// ====================================================================
// Configuração de moeda compartilhada por todo o app.
// Os valores no banco estão em BRL. A PreferencesContext atualiza a
// config (moeda + cotação) e os formatadores (formatBRL etc.) leem daqui,
// então a troca/conversão de moeda vale em TODAS as telas sem editar
// cada chamada.
// ====================================================================

export const CURRENCIES = {
  BRL: { code: 'BRL', symbol: 'R$', locale: 'pt-BR', label: 'Real (R$)' },
  USD: { code: 'USD', symbol: 'US$', locale: 'en-US', label: 'Dólar (US$)' },
  EUR: { code: 'EUR', symbol: '€', locale: 'de-DE', label: 'Euro (€)' },
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCIES);

// rate = quanto da moeda alvo equivale a 1 BRL (ex.: USD ~ 0.18).
let config = { currency: 'BRL', rate: 1 };

export function setMoneyConfig({ currency, rate }) {
  config = { currency: CURRENCIES[currency] ? currency : 'BRL', rate: Number(rate) || 1 };
}

export function getMoneyConfig() {
  return config;
}

// Recebe valor em BRL (como está no banco) e devolve formatado na moeda
// atual, convertido pela cotação.
export function formatMoney(brlValue) {
  const n = Number(brlValue);
  const { currency, rate } = config;
  const c = CURRENCIES[currency] ?? CURRENCIES.BRL;
  const value = Number.isFinite(n) ? (currency === 'BRL' ? n : n * rate) : 0;
  return new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.code }).format(value);
}
