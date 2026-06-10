import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useIsFetching } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  DollarSign, Users, TrendingUp, Wallet, ChevronRight, PiggyBank, Receipt,
  UserPlus, BadgeDollarSign, AlertTriangle, Megaphone, Landmark, RefreshCw, CalendarRange,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/features/auth/context/AuthContext';
import { supabase } from '@/infrastructure/supabase/client';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { leadsApi } from '@/features/comercial/api/leads.api';
import { mrrDoCliente, contratosApi } from '@/features/clientes/api/contratos.api';
import { formatBRL } from '@/features/clientes/utils/contrato.format';
import { financeiroApi, custosApi } from '@/features/financeiro/api/financeiro.api';
import { adsIsMock } from '@/lib/adsService';
import { queryKeys } from '@/entities/query-keys';
import MetricaModal from '@/features/financeiro/components/MetricaModal';
import CustosOperacionais from '@/features/financeiro/components/CustosOperacionais';
import {
  MES_LABELS, RECEITA_POR_CONVERSAO, flattenContratos, receitaSeriesYear, mrrSeriesYear,
  leadsSeriesYear, adsSeriesYear, novosClientesSeriesYear, contratosAVencer,
  custoOperacionalSeriesYear, mrrClientCountSeriesYear, parseDateLocal, sum,
  mrrAtual, tcvDoMes, clientesComContrato, cortarMesesFuturos,
} from '@/features/financeiro/lib/financeiro.calc';

const fmtInt = (v) => Math.round(Number(v) || 0).toLocaleString('pt-BR');
const fmtPct = (v) => `${(Number(v) || 0).toFixed(1)}%`;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const ACCENTS = {
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', hex: '#34d399' },
  blue: { text: 'text-blue-300', bg: 'bg-blue-500/10', hex: '#60a5fa' },
  red: { text: 'text-[#EA3935]', bg: 'bg-[#EA3935]/10', hex: '#EA3935' },
  purple: { text: 'text-purple-300', bg: 'bg-purple-500/10', hex: '#a78bfa' },
};

function KpiCard({ icon: Icon, label, value, sub, accent = 'red', onClick }) {
  const a = ACCENTS[accent] ?? ACCENTS.red;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left glass-card rounded-2xl border border-white/5 p-6 hover:border-white/10 hover:bg-white/[0.02] transition-colors"
    >
      <div className="flex items-start justify-between">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <div className={`w-9 h-9 rounded-xl ${a.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${a.text}`} />
        </div>
      </div>
      <p className="text-4xl font-semibold text-white tracking-tight leading-none tabular-nums mt-3">{value}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-muted-foreground">{sub}</p>
        <span className="text-[11px] text-muted-foreground/60 group-hover:text-muted-foreground inline-flex items-center gap-0.5">
          ver detalhes <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}

function MiniKpi({ icon: Icon, label, value, accent = 'red', hint, badge }) {
  const a = ACCENTS[accent] ?? ACCENTS.red;
  return (
    <div className={`glass-card rounded-2xl border border-white/5 p-4 ${hint ? 'cursor-help' : ''}`} title={hint || undefined}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${a.text}`} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            {badge && (
              <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">{badge}</span>
            )}
          </div>
          <p className="text-lg font-semibold text-white tracking-tight truncate tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Painel({ title, children, action }) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function FinanceiroPage() {
  const { user } = useAuth();
  const [metrica, setMetrica] = useState(null);
  const [view, setView] = useState('visao'); // 'visao' | 'custos'
  const [year, setYear] = useState(() => new Date().getFullYear());

  const isAdmin = user?.role === 'admin';
  const { data: clientes = [] } = useQuery({ queryKey: queryKeys.clientes.all, queryFn: clientesApi.list, enabled: isAdmin });
  const { data: leads = [] } = useQuery({ queryKey: queryKeys.leads.all, queryFn: leadsApi.list, enabled: isAdmin });
  const { data: metrics = [] } = useQuery({ queryKey: queryKeys.financeiro.metrics, queryFn: financeiroApi.listCampaignMetrics, enabled: isAdmin });
  const { data: custos = [] } = useQuery({ queryKey: queryKeys.financeiro.custos, queryFn: custosApi.list, enabled: isAdmin });

  const qc = useQueryClient();
  const refreshing = useIsFetching({
    predicate: (q) => ['clientes', 'leads', 'financeiro'].includes(q.queryKey?.[0]),
  }) > 0;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: queryKeys.clientes.all });
    qc.invalidateQueries({ queryKey: queryKeys.leads.all });
    qc.invalidateQueries({ queryKey: queryKeys.financeiro.metrics });
    qc.invalidateQueries({ queryKey: queryKeys.financeiro.custos });
  };

  // Ao abrir o Financeiro, expira contratos cujo prazo já passou (status ativo →
  // expirado). Assim, contratos finalizados deixam de contar no MRR/Receita de
  // forma automática; o realtime propaga a mudança para todas as abas.
  useEffect(() => {
    if (user?.role !== 'admin') return;
    contratosApi.expirarVencidos()
      .then((n) => { if (n) qc.invalidateQueries({ queryKey: queryKeys.clientes.all }); })
      .catch(() => { /* sem permissão / falha de rede: ignora */ });
  }, [user?.role, qc]);

  // Tempo real: invalida as queries assim que algo muda no banco.
  useEffect(() => {
    if (user?.role !== 'admin') return undefined;
    const channel = supabase
      .channel('financeiro-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contratos' }, () => qc.invalidateQueries({ queryKey: queryKeys.clientes.all }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => qc.invalidateQueries({ queryKey: queryKeys.clientes.all }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => qc.invalidateQueries({ queryKey: queryKeys.leads.all }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_metrics' }, () => qc.invalidateQueries({ queryKey: queryKeys.financeiro.metrics }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operational_costs' }, () => qc.invalidateQueries({ queryKey: queryKeys.financeiro.custos }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.role, qc]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const isCurrentYear = year === currentYear;
  const cm = now.getMonth();

  const calc = useMemo(() => {
    const contratos = flattenContratos(clientes);
    // No ano corrente, receita e custo são cortados no mês atual (não projetam
    // meses futuros), para roiAno/margemAno compararem realizado x realizado.
    const corta = (s) => cortarMesesFuturos(s, year, now);
    const receitaSeries = corta(receitaSeriesYear(contratos, year, now));
    const mrrSeries = corta(mrrSeriesYear(contratos, year, now));
    const leadsSeries = leadsSeriesYear(leads, year);
    const ads = adsSeriesYear(metrics, year);
    const novosSeries = novosClientesSeriesYear(clientes, year);
    const custoOpSeries = corta(custoOperacionalSeriesYear(custos, year, now));

    const custosSeries = ads.spend.map((s, i) => s + custoOpSeries[i]);
    // ROI Geral é baseado no CUSTO OPERACIONAL (aba Custos Operacionais), não no
    // gasto em ads: ROI = (receita − custo operacional) / custo operacional.
    const roiSeries = receitaSeries.map((rec, i) => (custoOpSeries[i] > 0 ? ((rec - custoOpSeries[i]) / custoOpSeries[i]) * 100 : 0));

    const receitaAno = sum(receitaSeries);
    const leadsAno = sum(leadsSeries);
    const gastoAno = sum(ads.spend);
    const custoOpAno = sum(custoOpSeries);
    const custosAno = gastoAno + custoOpAno;
    const roiAno = custoOpAno > 0 ? ((receitaAno - custoOpAno) / custoOpAno) * 100 : 0;

    const mrrMes = mrrSeries[cm];
    const mrrAno = sum(mrrSeries);
    const pontualAno = Math.max(receitaAno - mrrAno, 0);

    // MRR do mês = valor de contrato MRR atribuído a cada cliente não-churn
    // (snapshot). Só muda quando entra um novo contrato ou um contrato encerra.
    const mrrClientes = mrrAtual(clientes);
    // Receita do mês = MRR do mês + TCV (pontual) fechado NESTE mês. Reinicia
    // todo mês: no início do mês não há TCV novo, então Receita = MRR; sobe a
    // cada novo cliente TCV fechado no mês corrente.
    const tcvMes = tcvDoMes(clientes, year, cm);
    const receitaClientes = mrrClientes + tcvMes;
    const nClientesContrato = clientesComContrato(clientes);
    // ROI do mês = (Receita do mês − Custo Operacional do mês) / Custo Operacional do mês.
    const gastoMes = custosSeries[cm];
    const custoOpMes = custoOpSeries[cm];
    const roiMesClientes = custoOpMes > 0 ? ((receitaClientes - custoOpMes) / custoOpMes) * 100 : 0;

    // Ticket médio período-consistente: MRR do mês de referência ÷ nº de
    // clientes com MRR ativo nesse mês. No ano corrente, ref = mês atual; em
    // anos fechados, ref = último mês com MRR (evita misturar com "hoje").
    const isCY = year === now.getFullYear();
    const clientesAtivos = clientes.filter((c) => c.status === 'ativo');
    const mrrCountSeries = mrrClientCountSeriesYear(contratos, year, now);
    let refMonth = isCY ? cm : 11;
    if (!isCY) {
      for (let m = 11; m >= 0; m -= 1) { if (mrrSeries[m] > 0) { refMonth = m; break; } }
    }
    const ticketMedio = mrrCountSeries[refMonth] > 0 ? mrrSeries[refMonth] / mrrCountSeries[refMonth] : 0;

    const custosMes = custosSeries[cm];
    const margemMes = receitaClientes - custosMes;

    // ROAS de mídia (retorno sobre o gasto em ads).
    const convAno = sum(ads.conversions);
    const roasMes = ads.roas[cm];
    const roasAno = gastoAno > 0 ? (convAno * RECEITA_POR_CONVERSAO) / gastoAno : 0;

    // Gasto por plataforma (ano)
    const gastoPlat = { meta: 0, google: 0 };
    for (const m of metrics) {
      const d = parseDateLocal(m.date);
      if (!d || d.getFullYear() !== year) continue;
      const plat = m.campaigns?.platform;
      if (plat === 'meta') gastoPlat.meta += num(m.spend);
      else if (plat === 'google') gastoPlat.google += num(m.spend);
    }

    const topMrr = clientes
      .map((c) => ({ c, mrr: c.status === 'churn' ? 0 : mrrDoCliente(c.contratos) }))
      .filter((r) => r.mrr > 0)
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 5);

    const aVencer = contratosAVencer(contratos, 30, now).slice(0, 6);

    const margemAno = receitaAno - custosAno;

    return {
      receitaSeries, mrrSeries, leadsSeries, ads, novosSeries, custoOpSeries, roiSeries,
      receitaAno, leadsAno, gastoAno, custoOpAno, custosAno, roiAno, margemAno,
      mrrMes, mrrAno, pontualAno, roasMes, roasAno,
      mrrClientes, tcvMes, receitaClientes, nClientesContrato, gastoMes, custoOpMes, roiMesClientes,
      clientesAtivos: clientesAtivos.length, ticketMedio, custosMes, margemMes,
      gastoPlat, topMrr, aVencer,
    };
  }, [clientes, leads, metrics, custos, year, cm, now]);

  const anosDisponiveis = useMemo(() => {
    const set = new Set([currentYear]);
    for (const c of custos) if (c.competencia) set.add(Number(String(c.competencia).slice(0, 4)));
    for (const cl of clientes) for (const ct of cl.contratos || []) if (ct.data_inicio) set.add(Number(String(ct.data_inicio).slice(0, 4)));
    for (const l of leads) if (l.created_at) set.add(new Date(l.created_at).getFullYear());
    for (const m of metrics) if (m.date) set.add(Number(String(m.date).slice(0, 4)));
    return Array.from(set).filter((y) => y <= currentYear).sort((a, b) => b - a);
  }, [custos, clientes, leads, metrics, currentYear]);

  if (user?.role !== 'admin') {
    return <RestrictedAccessCard description="Apenas administradores podem acessar o Financeiro." />;
  }

  // Ano atual: cards mostram o MÊS atual. Anos passados (fechados): mostram o total do ano.
  const cards = [
    {
      key: 'receita', icon: DollarSign, accent: 'emerald',
      label: isCurrentYear ? 'Receita do mês' : `Receita · ${year}`,
      value: isCurrentYear ? formatBRL(calc.receitaClientes) : formatBRL(calc.receitaAno),
      sub: isCurrentYear ? `MRR ${formatBRL(calc.mrrClientes)} + TCV do mês ${formatBRL(calc.tcvMes)}` : `Média/mês: ${formatBRL(calc.receitaAno / 12)}`,
      modal: { title: 'Receita', icon: DollarSign, accent: 'emerald', format: formatBRL, series: calc.receitaSeries, chartType: 'area', annualLabel: `Receita no ano (${year})`, annualValue: calc.receitaAno },
    },
    {
      key: 'leads', icon: Users, accent: 'blue',
      label: isCurrentYear ? 'Leads do mês' : `Leads · ${year}`,
      value: isCurrentYear ? fmtInt(calc.leadsSeries[cm]) : fmtInt(calc.leadsAno),
      sub: isCurrentYear ? `Total no ano: ${fmtInt(calc.leadsAno)}` : `Média/mês: ${fmtInt(calc.leadsAno / 12)}`,
      modal: { title: 'Leads', icon: Users, accent: 'blue', format: fmtInt, series: calc.leadsSeries, chartType: 'bar', annualLabel: `Leads no ano (${year})`, annualValue: calc.leadsAno },
    },
    {
      key: 'roi', icon: TrendingUp, accent: 'red',
      label: isCurrentYear ? 'ROI Geral (mês)' : `ROI Geral · ${year}`,
      value: isCurrentYear ? fmtPct(calc.roiMesClientes) : fmtPct(calc.roiAno),
      sub: isCurrentYear ? `Receita ${formatBRL(calc.receitaClientes)} · Custo op. ${formatBRL(calc.custoOpMes)}` : `Custo op. no ano: ${formatBRL(calc.custoOpAno)}`,
      modal: { title: 'ROI Geral', icon: TrendingUp, accent: 'red', format: fmtPct, series: calc.roiSeries, chartType: 'bar', annualLabel: `ROI no ano (${year})`, annualValue: calc.roiAno, subtitle: 'ROI % mês a mês = (receita − custo operacional) / custo operacional' },
    },
    {
      key: 'mrr', icon: Wallet, accent: 'purple',
      label: isCurrentYear ? 'MRR do mês' : `MRR total · ${year}`,
      value: isCurrentYear ? formatBRL(calc.mrrClientes) : formatBRL(calc.mrrAno),
      sub: isCurrentYear ? `${calc.nClientesContrato} clientes com contrato` : `Média/mês: ${formatBRL(calc.mrrAno / 12)}`,
      modal: { title: 'MRR', icon: Wallet, accent: 'purple', format: formatBRL, series: calc.mrrSeries, chartType: 'area', annualLabel: `MRR total no ano (${year})`, annualValue: calc.mrrAno, subtitle: 'MRR recorrente mês a mês' },
    },
  ];

  const receitaData = calc.receitaSeries.map((valor, i) => ({ mes: MES_LABELS[i], valor }));
  const receitaTipoTotal = calc.mrrAno + calc.pontualAno || 1;
  const gastoTotalPlat = calc.gastoPlat.meta + calc.gastoPlat.google || 1;

  const ReceitaTooltip = ({ active, payload, label }) => (active && payload?.length ? (
    <div className="glass-card border border-white/10 rounded-xl p-2.5 text-xs">
      <p className="text-white font-medium mb-0.5">{label}</p>
      <p className="text-emerald-300">{formatBRL(payload[0].value)}</p>
    </div>
  ) : null);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="-mt-24 -mx-6">
        <div className="relative h-44 rounded-b-3xl overflow-hidden" style={{ backgroundImage: "url('/kairon-company-dark.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/75 pointer-events-none" />
        </div>
        <div className="px-6 -mt-10 relative">
          <div className="w-20 h-20 rounded-full bg-[#0d0d0d] border-2 border-white/10 flex items-center justify-center shadow-xl shadow-black/50">
            <Landmark className="w-8 h-8 text-white" />
          </div>
        </div>
        <div className="px-6 mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[1.7rem] font-bold text-white tracking-tight">Financeiro</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Visão financeira da agência — receita, MRR, leads e ROI de mídia. Clique em cada indicador para ver a evolução mês a mês e o total do ano de {year}.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28 bg-white/5 border-white/10 text-white h-9">
                <CalendarRange className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                {anosDisponiveis.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}{y === currentYear ? ' (atual)' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isCurrentYear && (
              <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border bg-emerald-500/10 border-emerald-500/20 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Tempo real
              </span>
            )}
            <Button
              onClick={refresh}
              disabled={refreshing}
              variant="outline"
              className="border-white/10 bg-transparent text-white hover:bg-white/5 h-9"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Sub-abas */}
      <div className="flex items-center gap-6 border-b border-white/10">
        {[{ id: 'visao', label: 'Visão Geral' }, { id: 'custos', label: 'Custos Operacionais' }].map((t) => {
          const active = view === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={`relative pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${active ? 'text-white border-[#EA3935]' : 'text-muted-foreground border-transparent hover:text-white'}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {view === 'custos' ? (
        <CustosOperacionais year={year} />
      ) : (
      <div className="space-y-6">
      {/* 4 KPIs principais (clicáveis) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <KpiCard key={c.key} icon={c.icon} label={c.label} value={c.value} sub={c.sub} accent={c.accent} onClick={() => setMetrica(c.modal)} />
        ))}
      </div>

      {/* KPIs secundários (mês para ano atual, ano para anos fechados) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MiniKpi icon={PiggyBank} label={isCurrentYear ? 'Margem do mês (receita − operacional − ads)' : `Margem ${year} (receita − operacional − ads)`} value={formatBRL(isCurrentYear ? calc.margemMes : calc.margemAno)} accent={(isCurrentYear ? calc.margemMes : calc.margemAno) >= 0 ? 'emerald' : 'red'} />
        <MiniKpi icon={Receipt} label={isCurrentYear ? 'Custo operacional (mês)' : `Custo operacional (${year})`} value={formatBRL(isCurrentYear ? calc.custoOpSeries[cm] : calc.custoOpAno)} accent="purple" />
        <MiniKpi icon={BadgeDollarSign} label={isCurrentYear ? 'Gasto em ads (mês)' : `Gasto em ads (${year})`} value={formatBRL(isCurrentYear ? calc.ads.spend[cm] : calc.gastoAno)} accent="red" badge={adsIsMock ? 'simulado' : undefined} hint={adsIsMock ? 'Dados de mídia simulados (modo mock).' : undefined} />
        <MiniKpi icon={TrendingUp} label={isCurrentYear ? 'ROAS estimado (mês)' : `ROAS estimado (${year})`} value={`${(isCurrentYear ? calc.roasMes : calc.roasAno).toFixed(1).replace('.', ',')}×`} accent="emerald" badge={adsIsMock ? 'simulado' : undefined} hint={`${adsIsMock ? 'Dados de mídia simulados (modo mock). ' : ''}Estimado: R$ ${RECEITA_POR_CONVERSAO}/conversão — proxy de ROAS, ainda sem receita real atribuída a mídia.`} />
        <MiniKpi icon={UserPlus} label="Ticket médio (MRR/cliente)" value={formatBRL(calc.ticketMedio)} accent="blue" hint="Ticket médio = MRR vigente do mês ÷ clientes com MRR vigente no mês. Não usa o MRR snapshot nem o total de clientes com contrato (que inclui TCV)." />
      </div>

      {/* Hero: receita mês a mês + composição/gasto */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card rounded-2xl border border-white/5 p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-4">Receita mês a mês · {year}</p>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={receitaData}>
              <defs>
                <linearGradient id="grad-receita-page" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={48} />
              <Tooltip content={<ReceitaTooltip />} />
              <Area type="monotone" dataKey="valor" name="Receita" stroke="#34d399" strokeWidth={2} fill="url(#grad-receita-page)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          {/* Receita por tipo */}
          <div className="glass-card rounded-2xl border border-white/5 p-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">Receita por tipo · ano</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-emerald-300">Recorrente (MRR)</span>
                  <span className="text-white tabular-nums">{formatBRL(calc.mrrAno)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(calc.mrrAno / receitaTipoTotal) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-blue-300">Pontual (TCV)</span>
                  <span className="text-white tabular-nums">{formatBRL(calc.pontualAno)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(calc.pontualAno / receitaTipoTotal) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Gasto por plataforma */}
          <div className="glass-card rounded-2xl border border-white/5 p-5">
            <div className="flex items-center gap-1.5 mb-3">
              <Megaphone className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Gasto em ads por plataforma · ano</p>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#5b9cf5]">Meta</span>
                  <span className="text-white tabular-nums">{formatBRL(calc.gastoPlat.meta)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-[#1877F2] rounded-full" style={{ width: `${(calc.gastoPlat.meta / gastoTotalPlat) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#5ec77e]">Google</span>
                  <span className="text-white tabular-nums">{formatBRL(calc.gastoPlat.google)}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-[#34A853] rounded-full" style={{ width: `${(calc.gastoPlat.google / gastoTotalPlat) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top clientes + Contratos a vencer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Painel title="Top clientes por MRR">
          {calc.topMrr.length === 0 ? (
            <div className="p-8 text-center"><p className="text-sm text-muted-foreground">Nenhum MRR ativo.</p></div>
          ) : (
            <div className="divide-y divide-white/5">
              {calc.topMrr.map(({ c, mrr }) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-full bg-[#EA3935]/15 border border-[#EA3935]/60 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {c.nome?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{c.nome}</p>
                    {c.empresa && <p className="text-xs text-muted-foreground truncate">{c.empresa}</p>}
                  </div>
                  <p className="text-sm font-semibold text-white tabular-nums shrink-0">
                    {formatBRL(mrr)}<span className="text-[10px] text-muted-foreground font-normal">/mês</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </Painel>

        <Painel title="Contratos a vencer (30 dias)">
          {calc.aVencer.length === 0 ? (
            <div className="p-8 text-center"><p className="text-sm text-muted-foreground">Nenhum contrato vencendo nos próximos 30 dias.</p></div>
          ) : (
            <div className="divide-y divide-white/5">
              {calc.aVencer.map((ct) => {
                const dias = Math.ceil((new Date(ct.data_fim) - now) / (1000 * 60 * 60 * 24));
                return (
                  <div key={ct.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-amber-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{ct._cliente?.nome ?? 'Cliente'}</p>
                      <p className="text-xs text-muted-foreground">{ct.tipo} · {formatBRL(ct.valor)}{ct.tipo === 'MRR' ? '/mês' : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-amber-300">{dias === 0 ? 'hoje' : `${dias} dia${dias > 1 ? 's' : ''}`}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(ct.data_fim).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Painel>
      </div>
      </div>
      )}

      {metrica && <MetricaModal metrica={metrica} onClose={() => setMetrica(null)} />}
    </div>
  );
}
