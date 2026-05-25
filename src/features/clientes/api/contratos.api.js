import { supabase } from '@/infrastructure/supabase/client';

const TABLE = 'contratos';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

const CONTRATO_SELECT =
  'id, cliente_id, tipo, valor, duracao_meses, data_inicio, data_fim, entregaveis, status, renovacao_de, data_cancelamento, motivo_cancelamento, notas, created_by, created_at, updated_at';

function emptyOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

export const contratosApi = {
  listByCliente: (clienteId) =>
    supabase
      .from(TABLE)
      .select(CONTRATO_SELECT)
      .eq('cliente_id', clienteId)
      .order('data_inicio', { ascending: false })
      .then(unwrap),

  criar: async ({ cliente_id, tipo, valor, duracao_meses, data_inicio, entregaveis, notas }) => {
    const { data, error } = await supabase.rpc('criar_contrato', {
      p_cliente_id: cliente_id,
      p_tipo: tipo,
      p_valor: valor,
      p_duracao_meses: duracao_meses,
      p_data_inicio: data_inicio,
      p_entregaveis:
        Array.isArray(entregaveis) && entregaveis.length > 0 ? entregaveis : null,
      p_notas: emptyOrNull(notas),
    });
    if (error) throw error;
    return data;
  },

  renovar: async ({
    contrato_anterior_id,
    tipo,
    valor,
    duracao_meses,
    data_inicio,
    entregaveis,
    notas,
  }) => {
    const { data, error } = await supabase.rpc('renovar_contrato', {
      p_contrato_anterior_id: contrato_anterior_id,
      p_tipo: tipo,
      p_valor: valor,
      p_duracao_meses: duracao_meses,
      p_data_inicio: data_inicio,
      p_entregaveis:
        Array.isArray(entregaveis) && entregaveis.length > 0 ? entregaveis : null,
      p_notas: emptyOrNull(notas),
    });
    if (error) throw error;
    return data;
  },

  cancelar: async ({ contrato_id, motivo }) => {
    const { error } = await supabase.rpc('cancelar_contrato', {
      p_contrato_id: contrato_id,
      p_motivo: motivo,
    });
    if (error) throw error;
  },

  expirarVencidos: async () => {
    const { data, error } = await supabase.rpc('expire_due_contracts');
    if (error) throw error;
    return data;
  },
};

export function getContratoAtivo(contratos) {
  if (!Array.isArray(contratos)) return null;
  return contratos.find((c) => c.status === 'ativo') ?? null;
}

export function mrrDoCliente(contratos) {
  const ativo = getContratoAtivo(contratos);
  if (!ativo || ativo.tipo !== 'MRR') return 0;
  return Number(ativo.valor) || 0;
}

export function tcvHistorico(contratos) {
  if (!Array.isArray(contratos)) return 0;
  return contratos
    .filter((c) => c.tipo === 'TCV' && c.status !== 'cancelado')
    .reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
}

export function ltvEstimado(contratos) {
  if (!Array.isArray(contratos)) return 0;
  return contratos
    .filter((c) => c.status !== 'cancelado')
    .reduce((sum, c) => {
      const valor = Number(c.valor) || 0;
      const meses = Number(c.duracao_meses) || 0;
      return sum + (c.tipo === 'MRR' ? valor * meses : valor);
    }, 0);
}
