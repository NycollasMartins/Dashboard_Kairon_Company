// supabase/functions/generate-report/index.ts
//
// Edge Function: gera um relatório executivo de TODO o dashboard usando o Claude.
// O frontend agrega os números (Financeiro, Metas, Comercial, Campanhas, etc.) e
// envia aqui; esta função guarda a chave da Anthropic e devolve o relatório já
// estruturado em "blocos" (texto + gráficos + tabelas) prontos para renderizar.
//
// Body JSON: { summary: {...dados agregados}, periodo: "Junho de 2026" }
// Resposta:  { resumo: string, blocks: Block[] }
//
// Acesso: somente admin (mesma regra da tela /relatorios). A função gera
// chamadas pagas à Anthropic, então valida o JWT e o papel do chamador —
// o verify_jwt da plataforma sozinho aceita a anon key pública.
//
// Secret esperado (configure com: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...):
//   ANTHROPIC_API_KEY -> chave da API da Anthropic
// Preenchidos automaticamente pela plataforma: SUPABASE_URL, SUPABASE_ANON_KEY
//
// Deploy: supabase functions deploy generate-report

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-8';

// Formato de bloco que o frontend sabe renderizar. Mantido em sincronia com
// apps/web/src/features/relatorios/components/ReportBlocks.jsx.
const FORMATO_BLOCOS = `
Cada item de "blocks" é um objeto com um campo "type". Tipos válidos:

- { "type": "heading", "text": "Título", "level": 1 }       // level 1 (seção) ou 2 (subseção)
- { "type": "paragraph", "text": "Texto corrido em pt-BR." }
- { "type": "kpis", "items": [ { "label": "Receita do mês", "value": "R$ 32.500", "hint": "MRR + TCV" } ] }
- { "type": "chart", "chartType": "bar"|"line"|"area"|"pie", "title": "Receita mês a mês",
    "data": [ { "name": "Jan", "value": 12000, "value2": 8000 } ],
    "seriesLabels": { "value": "Receita", "value2": "Custos" } }   // value2/seriesLabels são opcionais
- { "type": "table", "title": "Top clientes", "columns": ["Cliente","MRR"], "rows": [["Acme","R$ 5.000"]] }
- { "type": "divider" }
`;

const SYSTEM_PROMPT = `Você é um analista de operações e finanças de uma agência de marketing (Kairon Company).
Você recebe um JSON com os números já consolidados do dashboard (financeiro, metas, comercial/leads, campanhas, clientes e tarefas) e produz um RELATÓRIO EXECUTIVO em português do Brasil.

Regras obrigatórias:
- Use SOMENTE os números fornecidos no JSON. NUNCA invente dados, datas ou valores.
- Moeda no formato brasileiro: "R$ 12.500" (sem centavos quando inteiro). Percentuais com 1 casa: "12,3%".
- Em gráficos (chart), os campos "value"/"value2" devem ser NÚMEROS puros (sem "R$"). Em kpis e table use strings já formatadas.
- Seja analítico: aponte tendências, riscos (ex.: contratos a vencer, margem negativa, meta distante) e destaques.
- Estruture o relatório em seções claras: Resumo executivo, Financeiro, Metas & Vendas, Comercial (Leads), Campanhas/Mídia, Clientes & Operação.
- Para cada seção relevante, combine TEXTO (paragraph) com o GRÁFICO ou TABELA mais adequado. O que é evolução no tempo → gráfico de linha/área/barra; composição → pizza; rankings/listas → tabela; indicadores-chave → kpis.
- Não repita um número em texto e gráfico sem necessidade; o texto interpreta, o gráfico/tabela mostra.

Responda EXCLUSIVAMENTE com um único objeto JSON válido (sem markdown, sem cercas de código, sem comentários) no formato:
{ "resumo": "1-2 frases de visão geral", "blocks": [ ... ] }
${FORMATO_BLOCOS}`;

function extrairJSON(texto: string): unknown {
  // Remove cercas de código se houver e isola o primeiro objeto {...}.
  const semFence = texto.replace(/```(?:json)?/gi, '').trim();
  const ini = semFence.indexOf('{');
  const fim = semFence.lastIndexOf('}');
  if (ini === -1 || fim === -1 || fim <= ini) {
    throw new Error('A resposta do Claude não continha um JSON válido.');
  }
  return JSON.parse(semFence.slice(ini, fim + 1));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResponse({ error: 'Server misconfigured.' }, 500);
  }

  // Valida o caller pelo JWT e exige role admin.
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing auth token.' }, 401);
  }
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: caller },
    error: callerErr,
  } = await callerClient.auth.getUser();
  if (callerErr || !caller) {
    return jsonResponse({ error: 'Invalid session.' }, 401);
  }
  const { data: profile } = await callerClient
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();
  if (!profile || profile.role !== 'admin') {
    return jsonResponse({ error: 'Forbidden: admin only.' }, 403);
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return jsonResponse(
        { error: 'ANTHROPIC_API_KEY não configurada. Rode: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...' },
        500,
      );
    }

    const body = await req.json().catch(() => ({}));
    const { summary, periodo } = body ?? {};
    if (!summary || typeof summary !== 'object') {
      return jsonResponse({ error: 'Corpo inválido: "summary" (dados agregados) é obrigatório.' }, 400);
    }

    const userContent = [
      `Período de referência: ${periodo ?? 'não informado'}.`,
      'Gere o relatório executivo a partir dos dados consolidados abaixo (JSON):',
      '```json',
      JSON.stringify(summary),
      '```',
    ].join('\n');

    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!res.ok) {
      let msg = `Erro da API Anthropic (HTTP ${res.status}).`;
      try {
        const err = await res.json();
        if (err?.error?.message) msg = err.error.message;
      } catch { /* corpo não-JSON */ }
      return jsonResponse({ error: msg }, 502);
    }

    const data = await res.json();
    // Pega o primeiro bloco de texto (blocos de thinking vêm vazios por padrão).
    const textBlock = Array.isArray(data?.content)
      ? data.content.find((b: { type?: string }) => b?.type === 'text')
      : null;
    if (!textBlock?.text) {
      return jsonResponse({ error: 'Resposta do Claude sem conteúdo de texto.' }, 502);
    }

    const parsed = extrairJSON(textBlock.text) as { resumo?: string; blocks?: unknown[] };
    if (!Array.isArray(parsed?.blocks)) {
      return jsonResponse({ error: 'O relatório retornado não tinha a lista de "blocks".' }, 502);
    }

    return jsonResponse({ resumo: parsed.resumo ?? '', blocks: parsed.blocks });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message ?? 'Erro ao gerar o relatório.' }, 500);
  }
});
