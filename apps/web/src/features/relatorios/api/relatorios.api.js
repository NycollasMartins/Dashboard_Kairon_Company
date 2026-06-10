import { supabase } from '@/infrastructure/supabase/client';

// Desempacota o retorno de supabase.functions.invoke, extraindo a mensagem de
// erro do corpo da resposta da Edge Function quando houver.
async function unwrapInvoke({ data, error }) {
  if (error) {
    let message = error.message || 'Erro ao gerar o relatório.';
    try {
      const response = error.context?.response;
      if (response && typeof response.json === 'function') {
        const body = await response.json();
        if (body?.error) message = body.error;
      }
    } catch { /* corpo não-JSON — mantém a mensagem original */ }
    throw new Error(message);
  }
  return data;
}

export const relatoriosApi = {
  /**
   * Gera o relatório executivo via Claude (Edge Function `generate-report`).
   * @param {object} summary dados agregados do dashboard (ver lib/aggregate.js)
   * @param {string} periodo rótulo do período, ex.: "Junho de 2026"
   * @returns {Promise<{ resumo: string, blocks: Array }>}
   */
  gerar: (summary, periodo) =>
    supabase.functions
      .invoke('generate-report', { body: { summary, periodo } })
      .then(unwrapInvoke),
};
