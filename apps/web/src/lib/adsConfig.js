// ====================================================================
// Configuração compartilhada de anúncios.
//
// RECEITA_POR_CONVERSAO: receita estimada (R$) por conversão de anúncio.
// PREMISSA: é um PROXY de ROAS — ainda NÃO há receita real atribuída a mídia
// (não rastreamos qual contrato/venda veio de qual campanha). Enquanto isso,
// o "ROAS estimado" = (conversões × RECEITA_POR_CONVERSAO) ÷ gasto.
//
// Fonte ÚNICA do valor (evita duplicar 80 em financeiro.calc.js e
// adsServiceCore.js). Configurável por env: VITE_RECEITA_POR_CONVERSAO.
//
// Próximo passo (não implementado): amarrar à receita real — marcar a campanha
// de origem no lead/contrato (ex.: leads.origem + campaign_id) e somar o
// valor dos contratos originados por mídia, em vez deste proxy fixo.
// ====================================================================
export const RECEITA_POR_CONVERSAO = Number(import.meta.env.VITE_RECEITA_POR_CONVERSAO) || 80;
