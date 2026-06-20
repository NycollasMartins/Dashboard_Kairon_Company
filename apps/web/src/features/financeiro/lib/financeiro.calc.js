// ====================================================================
// Shim do app para o MÓDULO ÚNICO de cálculo financeiro (@kairon/core).
// Toda a lógica vive em @kairon/core/finance/finance.calc — aqui só
// re-exportamos e injetamos o RECEITA_POR_CONVERSAO do ambiente (Vite),
// para o core não depender de import.meta.env.
// ====================================================================

import { RECEITA_POR_CONVERSAO } from '@/lib/adsConfig';
import * as core from '@kairon/core/finance/finance.calc';

export * from '@kairon/core/finance/finance.calc';
export { RECEITA_POR_CONVERSAO };

// adsSeriesYear com o valor de conversão do app (env) como padrão.
export function adsSeriesYear(metrics, year, receitaPorConversao = RECEITA_POR_CONVERSAO) {
  return core.adsSeriesYear(metrics, year, receitaPorConversao);
}
