import { supabase } from '../supabase/client.js';

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// Primeiro dia do mês (YYYY-MM-01) — competência usada nas metas.
export function competenciaDoMes(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

// Limites [primeiro dia, último dia] do mês de uma competência, como YYYY-MM-DD.
export function rangeDoMes(competencia) {
  const [y, m] = String(competencia).slice(0, 7).split('-').map(Number);
  const ini = `${y}-${String(m).padStart(2, '0')}-01`;
  const last = new Date(y, m, 0).getDate();
  const fim = `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { ini, fim };
}

export const metasApi = {
  // ---- Metas (global + individuais) ----
  listMetas: () =>
    supabase.from('metas').select('*').then(unwrap),

  // Cria/atualiza a meta (global se usuario_id = null; individual caso contrário).
  upsertMeta: async ({ competencia, usuario_id = null, valor_meta }) => {
    let q = supabase.from('metas').select('id').eq('competencia', competencia);
    q = usuario_id ? q.eq('usuario_id', usuario_id) : q.is('usuario_id', null);
    const { data: existing, error } = await q.maybeSingle();
    if (error) throw error;
    if (existing) {
      return supabase
        .from('metas')
        .update({ valor_meta })
        .eq('id', existing.id)
        .select('*')
        .single()
        .then(unwrap);
    }
    return supabase
      .from('metas')
      .insert({ competencia, usuario_id, valor_meta })
      .select('*')
      .single()
      .then(unwrap);
  },

  deleteMeta: (id) =>
    supabase.from('metas').delete().eq('id', id).then(unwrap),

  // ---- Vendas ----
  // Lista as vendas de um mês (competência = primeiro dia do mês).
  listVendasDoMes: (competencia) => {
    const { ini, fim } = rangeDoMes(competencia);
    return supabase
      .from('vendas')
      .select('*, closer:closer_id(id, full_name, email)')
      .gte('data_venda', ini)
      .lte('data_venda', fim)
      .order('data_venda', { ascending: false })
      .then(unwrap);
  },

  criarVenda: ({ closer_id, valor, tipo, cliente_nome, data_venda }) =>
    supabase
      .from('vendas')
      .insert({
        closer_id: closer_id || null,
        valor,
        tipo: tipo || null,
        cliente_nome: cliente_nome?.trim() || null,
        data_venda: data_venda || undefined,
      })
      .select('*, closer:closer_id(id, full_name, email)')
      .single()
      .then(unwrap),

  removerVenda: (id) =>
    supabase.from('vendas').delete().eq('id', id).then(unwrap),

  // MRR base do mês (contratos MRR ativos) — mesmo número do "MRR do mês" do
  // Financeiro. Vem por RPC SECURITY DEFINER (closer/TV não acessam clientes).
  mrrBase: async () => {
    const { data, error } = await supabase.rpc('mrr_base_ativo');
    if (error) throw error;
    return Number(data) || 0;
  },

  // TCV (pontual) dos contratos ATIVOS cujo início cai no mês corrente — o
  // "TCV do mês" do Financeiro. Via RPC SECURITY DEFINER (closer/TV não acessam
  // contratos/clientes). Compõe a Receita do mês usada como "Feito da meta".
  tcvMesBase: async () => {
    const { data, error } = await supabase.rpc('tcv_mes_ativo');
    if (error) throw error;
    return Number(data) || 0;
  },

  // ---- Closers (para ranking e metas individuais) ----
  listClosers: () =>
    supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('role', 'closer')
      .is('archived_at', null)
      .order('full_name', { ascending: true })
      .then(unwrap),
};
