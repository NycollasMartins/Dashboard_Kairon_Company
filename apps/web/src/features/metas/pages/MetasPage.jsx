import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation, useIsFetching } from '@tanstack/react-query';
import {
  Target, Trophy, Plus, Pencil, RefreshCw, TrendingUp, Crown, PartyPopper,
  BadgeDollarSign, Trash2, Medal, Maximize2, Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/context/AuthContext';
import { supabase } from '@/infrastructure/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { formatBRL, formatDateBR } from '@/features/clientes/utils/contrato.format';
import { queryKeys } from '@/entities/query-keys';
import { metasApi, competenciaDoMes } from '@/features/metas/api/metas.api';
import {
  montarRanking, progressoPct, faltaParaMeta, metaBatida, rotuloCompetencia, calcularSupermeta,
} from '@/features/metas/lib/metas.calc';
import VendaModal from '@/features/metas/components/VendaModal';
import MetaValorModal from '@/features/metas/components/MetaValorModal';
import CloserDetalheModal from '@/features/metas/components/CloserDetalheModal';

export default function MetasPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const role = user?.role;
  const isAdmin = role === 'admin';
  const isCloser = role === 'closer';
  const podeLancarVenda = isAdmin || isCloser;

  const competencia = useMemo(() => competenciaDoMes(new Date()), []);

  const { data: metas = [] } = useQuery({ queryKey: queryKeys.metas.all, queryFn: metasApi.listMetas });
  const { data: vendas = [] } = useQuery({ queryKey: queryKeys.metas.vendas(competencia), queryFn: () => metasApi.listVendasDoMes(competencia) });
  const { data: closers = [] } = useQuery({ queryKey: queryKeys.metas.closers, queryFn: metasApi.listClosers });
  // Receita recorrente já garantida do mês (MRR ativo = "MRR do mês" do Financeiro).
  const { data: mrrBase = 0 } = useQuery({ queryKey: queryKeys.metas.mrrBase, queryFn: metasApi.mrrBase });

  const refreshing = useIsFetching({ predicate: (q) => q.queryKey?.[0] === 'metas' }) > 0;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: queryKeys.metas.all });
    qc.invalidateQueries({ queryKey: queryKeys.metas.vendas(competencia) });
    qc.invalidateQueries({ queryKey: queryKeys.metas.closers });
    qc.invalidateQueries({ queryKey: queryKeys.metas.mrrBase });
  };

  // Tempo real: vendas e metas atualizam ao vivo. Como criar contrato gera uma
  // venda, a aba também reflete novos contratos automaticamente.
  useEffect(() => {
    const channel = supabase
      .channel('metas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendas' }, () => {
        qc.invalidateQueries({ queryKey: queryKeys.metas.vendas(competencia) });
        qc.invalidateQueries({ queryKey: queryKeys.metas.mrrBase });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'metas' }, () => qc.invalidateQueries({ queryKey: queryKeys.metas.all }))
      // MRR base muda quando um contrato é criado/cancelado/expira (sem mexer em vendas).
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contratos' }, () => qc.invalidateQueries({ queryKey: queryKeys.metas.mrrBase }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc, competencia]);

  // ---- Derivados ----
  const metaGlobal = useMemo(
    () => metas.find((m) => !m.usuario_id && m.competencia === competencia) || null,
    [metas, competencia],
  );
  const metaGlobalValor = Number(metaGlobal?.valor_meta) || 0;
  const mrrBaseValor = Number(mrrBase) || 0;
  // Vendas do mês com closer (entram no ranking + lista) e sem closer (só meta).
  const vendasComCloser = useMemo(() => vendas.filter((v) => v.closer_id), [vendas]);
  const totalDiretas = useMemo(
    () => vendas.filter((v) => !v.closer_id).reduce((s, v) => s + (Number(v.valor) || 0), 0),
    [vendas],
  );
  // Vendas que NÃO duplicam a base de MRR: um contrato MRR já entra no MRR base,
  // então sua venda não soma de novo. O que soma por cima é o novo pontual (TCV),
  // vendas avulsas e MRR manual (sem contrato).
  const vendasNovas = useMemo(() => vendas.filter((v) => !(v.tipo === 'MRR' && v.contrato_id)), [vendas]);
  const totalNovas = useMemo(() => vendasNovas.reduce((s, v) => s + (Number(v.valor) || 0), 0), [vendasNovas]);
  // Feito da meta = receita recorrente já garantida (MRR ativo) + novas vendas do mês.
  const feito = mrrBaseValor + totalNovas;
  const pct = progressoPct(feito, metaGlobalValor);
  const pctClamp = Math.min(100, Math.max(0, pct));
  const falta = faltaParaMeta(feito, metaGlobalValor);
  const batida = metaBatida(feito, metaGlobalValor);
  const temMeta = metaGlobalValor > 0;
  const excedente = Math.max(0, feito - metaGlobalValor);

  // Supermeta = tudo que passa da meta. Cada closer que vende depois de bater
  // a meta ganha comissão dobrada (2×).
  const { porCloser: superPorCloser } = useMemo(
    () => calcularSupermeta(vendasNovas, metaGlobalValor, mrrBaseValor),
    [vendasNovas, metaGlobalValor, mrrBaseValor],
  );
  const superDireto = superPorCloser.get('__direto__') || 0;

  const ranking = useMemo(
    () => montarRanking({ closers, vendas, metas, competencia }).map((e) => ({
      ...e,
      super: superPorCloser.get(e.id) || 0,
    })),
    [closers, vendas, metas, competencia, superPorCloser],
  );
  const rankingComSuper = ranking.filter((e) => e.super > 0);
  // Só vendas de closer ganham 2× (o excedente de MRR/diretas não é comissionado).
  const totalSuperCloser = rankingComSuper.reduce((s, e) => s + (Number(e.super) || 0), 0);

  // ---- Modais ----
  const [showVenda, setShowVenda] = useState(false);
  const [showMetaGlobal, setShowMetaGlobal] = useState(false);
  const [closerDetalhe, setCloserDetalhe] = useState(null);
  const [editarMetaCloser, setEditarMetaCloser] = useState(null);

  // ---- Tela cheia (modo painel/TV) ----
  const [fullscreen, setFullscreen] = useState(false);
  const entrarTelaCheia = async () => {
    try { await document.documentElement.requestFullscreen?.(); } catch { /* sem fullscreen do navegador, segue só com o overlay */ }
    setFullscreen(true);
  };
  const sairTelaCheia = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen?.(); } catch { /* ignora */ }
    setFullscreen(false);
  };
  // Sincroniza com o ESC/saída de fullscreen do navegador.
  useEffect(() => {
    const onFsChange = () => { if (!document.fullscreenElement) setFullscreen(false); };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // ---- Mutations ----
  const criarVenda = useMutation({
    mutationFn: metasApi.criarVenda,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.metas.vendas(competencia) });
      setShowVenda(false);
      toast({ title: 'Venda registrada!' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Erro ao registrar venda', description: err?.message }),
  });

  const salvarMetaGlobal = useMutation({
    mutationFn: (valor_meta) => metasApi.upsertMeta({ competencia, usuario_id: null, valor_meta }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.metas.all });
      setShowMetaGlobal(false);
      toast({ title: 'Meta do mês atualizada!' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Erro ao salvar meta', description: err?.message }),
  });

  const salvarMetaCloser = useMutation({
    mutationFn: ({ usuario_id, valor_meta }) => metasApi.upsertMeta({ competencia, usuario_id, valor_meta }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.metas.all });
      setEditarMetaCloser(null);
      setCloserDetalhe(null);
      toast({ title: 'Meta individual atualizada!' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Erro ao salvar meta', description: err?.message }),
  });

  const removerVenda = useMutation({
    mutationFn: metasApi.removerVenda,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.metas.vendas(competencia) });
      toast({ title: 'Venda removida.' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Erro ao remover', description: err?.message }),
  });

  // Venda gerada por contrato é gerida pelo próprio contrato (não se remove aqui).
  const podeRemoverVenda = (v) => !v.contrato_id && (isAdmin || v.created_by === user?.id);
  const medalha = ['text-amber-300', 'text-zinc-300', 'text-amber-600'];

  return (
    <div className={fullscreen ? 'fixed inset-0 z-[90] bg-background overflow-y-auto p-6 space-y-6' : 'space-y-6 animate-fade-in'}>
      {fullscreen ? (
        /* Header compacto no modo painel/TV — só os dados */
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#EA3935]/10 flex items-center justify-center">
              <Target className="w-6 h-6 text-[#EA3935]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight leading-none">Metas — {rotuloCompetencia(competencia)}</h1>
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Atualização em tempo real
              </p>
            </div>
          </div>
          <Button onClick={sairTelaCheia} variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 h-9">
            <Minimize2 className="w-4 h-4 mr-1.5" /> Sair da tela cheia
          </Button>
        </div>
      ) : (
      /* Header */
      <div className="-mt-24 -mx-6">
        <div className="relative h-44 rounded-b-3xl overflow-hidden" style={{ backgroundImage: "url('/kairon-company-dark.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/75 pointer-events-none" />
        </div>
        <div className="px-6 -mt-10 relative">
          <div className="w-20 h-20 rounded-full bg-[#0d0d0d] border-2 border-white/10 flex items-center justify-center shadow-xl shadow-black/50">
            <Target className="w-8 h-8 text-[#EA3935]" />
          </div>
        </div>
        <div className="px-6 mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[1.7rem] font-bold text-white tracking-tight">Metas</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Meta de vendas de {rotuloCompetencia(competencia)} e ranking dos closers em tempo real.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border bg-emerald-500/10 border-emerald-500/20 text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Tempo real
            </span>
            <Button onClick={entrarTelaCheia} variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 h-9">
              <Maximize2 className="w-4 h-4 mr-1.5" /> Tela cheia
            </Button>
            <Button onClick={refresh} disabled={refreshing} variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 h-9">
              <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
            {podeLancarVenda && (
              <Button onClick={() => setShowVenda(true)} className="bg-[#EA3935] hover:bg-[#d32f2c] text-white h-9">
                <Plus className="w-4 h-4 mr-1.5" /> Registrar venda
              </Button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Card grande: Meta do Mês */}
      <div className="glass-card rounded-2xl border border-white/5 p-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#EA3935]/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-[#EA3935]" />
            </div>
            <div>
              <p className="text-[13px] text-muted-foreground">Meta do mês</p>
              <p className="text-3xl font-semibold text-white tracking-tight tabular-nums leading-tight">
                {temMeta ? formatBRL(metaGlobalValor) : '—'}
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowMetaGlobal(true)} variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 h-9">
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> {temMeta ? 'Editar meta' : 'Definir meta'}
            </Button>
          )}
        </div>

        {temMeta ? (
          <>
            {/* 3 valores: feito, falta, meta */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Feito da meta</p>
                <p className="text-2xl font-semibold text-white tabular-nums mt-1">{formatBRL(feito)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Recorrente (MRR) {formatBRL(mrrBaseValor)} + Novas vendas {formatBRL(totalNovas)}</p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                <p className="text-[11px] text-muted-foreground">Falta da meta</p>
                <p className={`text-2xl font-semibold tabular-nums mt-1 ${batida ? 'text-emerald-300' : 'text-white'}`}>
                  {batida ? formatBRL(0) : formatBRL(falta)}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1"><BadgeDollarSign className="w-3 h-3" /> Excedente</p>
                <p className="text-2xl font-semibold text-emerald-300 tabular-nums mt-1">{formatBRL(excedente)}</p>
              </div>
            </div>

            {/* Linha de loading da meta (%) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Progresso da meta</span>
                <div className="flex items-center gap-2">
                  {batida && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2.5 py-0.5">
                      <PartyPopper className="w-3.5 h-3.5" /> Meta batida!
                    </span>
                  )}
                  <span className={`text-sm font-bold tabular-nums ${batida ? 'text-emerald-300' : 'text-[#EA3935]'}`}>{pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-4 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${batida ? 'bg-emerald-400' : 'bg-[#EA3935]'}`}
                  style={{ width: `${pctClamp}%` }}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-white/[0.02] border border-dashed border-white/10 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Defina a meta do mês para acompanhar o progresso.' : 'A meta do mês ainda não foi definida pelo administrador.'}
            </p>
          </div>
        )}
      </div>

      {/* Supermeta — aparece quando a meta é batida */}
      {batida && (
        <div className="glass-card rounded-2xl border border-emerald-500/20 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 bg-emerald-500/[0.05] flex items-center justify-between">
            <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-medium flex items-center gap-1.5">
              <PartyPopper className="w-3.5 h-3.5" /> Supermeta ativa · comissão dobrada (2×)
            </p>
            <span className="text-[11px] text-muted-foreground">Acima da meta</span>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 p-4">
                <p className="text-[11px] text-muted-foreground">Total acima da meta (excedente)</p>
                <p className="text-2xl font-semibold text-emerald-300 tabular-nums mt-1">{formatBRL(excedente)}</p>
              </div>
              <div className="rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 p-4">
                <p className="text-[11px] text-muted-foreground">Vendas de closer na supermeta (2× = {formatBRL(totalSuperCloser * 2)})</p>
                <p className="text-2xl font-semibold text-emerald-300 tabular-nums mt-1">{formatBRL(totalSuperCloser)}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Toda venda feita após bater a meta entra na supermeta e vale <span className="text-emerald-300 font-semibold">comissão dobrada</span>.
            </p>

            {rankingComSuper.length > 0 ? (
              <div className="rounded-xl border border-white/5 divide-y divide-white/5 overflow-hidden">
                {rankingComSuper.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-white font-semibold text-xs shrink-0">
                      {e.nome?.[0]?.toUpperCase() || '?'}
                    </div>
                    <p className="text-sm text-white flex-1 min-w-0 truncate">{e.nome}</p>
                    <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 shrink-0">2×</span>
                    <p className="text-sm font-semibold text-emerald-300 tabular-nums shrink-0">{formatBRL(e.super)}</p>
                  </div>
                ))}
                {superDireto > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground text-xs shrink-0">∑</div>
                    <p className="text-sm text-muted-foreground flex-1 min-w-0 truncate">Vendas diretas (sem closer)</p>
                    <p className="text-sm font-semibold text-white tabular-nums shrink-0">{formatBRL(superDireto)}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma venda de closer na supermeta ainda.</p>
            )}
          </div>
        </div>
      )}

      {/* Ranking de closers */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5 text-amber-300" /> Ranking de vendas — {rotuloCompetencia(competencia)}
          </p>
          <span className="text-[11px] text-muted-foreground">{ranking.length} closer{ranking.length === 1 ? '' : 's'}</span>
        </div>

        {ranking.length === 0 ? (
          <div className="p-8 text-center">
            <Trophy className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum closer cadastrado ainda.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {ranking.map((e, i) => {
              const ePct = progressoPct(e.total, e.meta);
              const ePctClamp = Math.min(100, Math.max(0, ePct));
              const eBatida = metaBatida(e.total, e.meta);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setCloserDetalhe({ entry: e, posicao: i + 1 })}
                  className="w-full text-left flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="w-7 flex items-center justify-center shrink-0">
                    {i < 3 ? <Medal className={`w-5 h-5 ${medalha[i]}`} /> : <span className="text-sm font-semibold text-muted-foreground tabular-nums">{i + 1}</span>}
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#EA3935]/15 border border-[#EA3935]/60 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {e.nome?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{e.nome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-1.5 flex-1 max-w-[180px] rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full rounded-full ${eBatida ? 'bg-emerald-400' : 'bg-[#EA3935]'}`} style={{ width: `${e.meta > 0 ? ePctClamp : 0}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {e.meta > 0 ? `${ePct.toFixed(0)}% de ${formatBRL(e.meta)}` : 'sem meta'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white tabular-nums">{formatBRL(e.total)}</p>
                    <p className="text-[10px] text-muted-foreground">{e.count} venda{e.count === 1 ? '' : 's'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Vendas do mês (lista) */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Vendas do mês</p>
          {totalDiretas > 0 && (
            <span className="text-[11px] text-muted-foreground">+ {formatBRL(totalDiretas)} sem responsável (só na meta)</span>
          )}
        </div>
        {vendasComCloser.length === 0 ? (
          <div className="p-8 text-center"><p className="text-sm text-muted-foreground">Nenhuma venda de closer neste mês.</p></div>
        ) : (
          <div className="divide-y divide-white/5">
            {vendasComCloser.map((v) => (
              <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <BadgeDollarSign className="w-4 h-4 text-emerald-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {v.closer?.full_name || 'Closer'}
                    {v.cliente_nome ? <span className="text-muted-foreground font-normal"> · {v.cliente_nome}</span> : null}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {v.tipo ? <span className="text-muted-foreground/80">{v.tipo} · </span> : null}{formatDateBR(v.data_venda)}
                  </p>
                </div>
                <p className="text-sm font-semibold text-white tabular-nums shrink-0">{formatBRL(v.valor)}</p>
                {podeRemoverVenda(v) && (
                  <button
                    type="button"
                    onClick={() => removerVenda.mutate(v.id)}
                    title="Remover venda"
                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modais */}
      {showVenda && (
        <VendaModal
          isAdmin={isAdmin}
          currentUser={user}
          closers={closers}
          isSubmitting={criarVenda.isPending}
          onClose={() => setShowVenda(false)}
          onConfirm={(payload) => criarVenda.mutate(payload)}
        />
      )}

      {showMetaGlobal && (
        <MetaValorModal
          title="Meta do mês"
          subtitle={rotuloCompetencia(competencia)}
          currentValue={metaGlobalValor}
          isSubmitting={salvarMetaGlobal.isPending}
          onClose={() => setShowMetaGlobal(false)}
          onConfirm={(valor) => salvarMetaGlobal.mutate(valor)}
        />
      )}

      {closerDetalhe && (
        <CloserDetalheModal
          entry={closerDetalhe.entry}
          posicao={closerDetalhe.posicao}
          isAdmin={isAdmin}
          onClose={() => setCloserDetalhe(null)}
          onEditMeta={(entry) => setEditarMetaCloser(entry)}
        />
      )}

      {editarMetaCloser && (
        <MetaValorModal
          title={`Meta de ${editarMetaCloser.nome}`}
          subtitle={rotuloCompetencia(competencia)}
          currentValue={editarMetaCloser.meta}
          isSubmitting={salvarMetaCloser.isPending}
          onClose={() => setEditarMetaCloser(null)}
          onConfirm={(valor) => salvarMetaCloser.mutate({ usuario_id: editarMetaCloser.id, valor_meta: valor })}
        />
      )}
    </div>
  );
}
