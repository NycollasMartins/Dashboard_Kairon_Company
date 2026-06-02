import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  ArrowLeft, Edit2, Pause, Play, Square, RefreshCw,
  DollarSign, Eye, MousePointerClick, Percent, Target, Users, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import CampanhaForm from '@/features/campanhas/components/CampanhaForm';
import { campanhasApi } from '@/features/campanhas/api/campanhas.api';
import { getAdsService } from '@/lib/adsService';
import {
  statusConfig, platformConfig, platformBadge, objectiveConfig, formatBRL, formatInt,
} from '@/features/campanhas/constants/campaignOptions';
import { queryKeys } from '@/entities/query-keys';

function MetricCard({ icon: Icon, label, value, accent = 'text-[#EA3935]' }) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-3.5 h-3.5 ${accent}`} />
        <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-semibold text-white tracking-tight tabular-nums">{value}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card border border-white/10 rounded-xl p-3 text-xs">
        <p className="text-white font-medium mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function CampanhaDetalhePage({ campanhaId, onBack }) {
  const [showEdit, setShowEdit] = useState(false);
  const [pausando, setPausando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const podeGerenciar = user?.role === 'admin';
  const qc = useQueryClient();

  const { data: campanha, isLoading } = useQuery({
    queryKey: queryKeys.campanhas.detail(campanhaId),
    queryFn: () => campanhasApi.get(campanhaId),
    enabled: !!campanhaId,
  });

  const { data: metrics = [] } = useQuery({
    queryKey: queryKeys.campanhas.metrics(campanhaId),
    queryFn: () => campanhasApi.listMetrics(campanhaId),
    enabled: !!campanhaId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.campanhas.detail(campanhaId) });
    qc.invalidateQueries({ queryKey: queryKeys.campanhas.all });
  };

  const atualizar = useMutation({
    mutationFn: (data) => campanhasApi.update(campanhaId, data),
    onSuccess: () => { invalidate(); setShowEdit(false); toast({ title: 'Campanha atualizada!' }); },
    onError: (err) => toast({ variant: 'destructive', title: 'Erro ao atualizar', description: err?.message }),
  });

  const mudarStatus = useMutation({
    mutationFn: async (novoStatus) => {
      const service = getAdsService(campanha.platform);
      try {
        if (novoStatus === 'paused') await service.pauseCampaign(campanha.external_id);
        else if (novoStatus === 'ended') await service.endCampaign(campanha.external_id);
        else if (novoStatus === 'active') await service.resumeCampaign(campanha.external_id);
      } catch {
        // mantém mudança local
      }
      return campanhasApi.updateStatus(campanhaId, novoStatus);
    },
    onSuccess: (_d, novoStatus) => {
      invalidate();
      setPausando(false);
      setEncerrando(false);
      toast({ title: novoStatus === 'paused' ? 'Campanha pausada.' : novoStatus === 'ended' ? 'Campanha encerrada.' : 'Campanha reativada.' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Erro ao alterar status', description: err?.message }),
  });

  const sincronizar = useMutation({
    mutationFn: async () => {
      const rows = await getAdsService(campanha.platform).getMetrics(campanha.external_id, { days: 14 });
      return campanhasApi.upsertMetrics(campanhaId, rows);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.campanhas.metrics(campanhaId) });
      toast({ title: 'Métricas sincronizadas!' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Erro ao sincronizar métricas', description: err?.message }),
  });

  const agg = useMemo(() => {
    const sum = (k) => metrics.reduce((s, m) => s + Number(m[k] || 0), 0);
    const spend = sum('spend');
    const impressions = sum('impressions');
    const clicks = sum('clicks');
    const conversions = sum('conversions');
    const reach = sum('reach');
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;
    const roas = spend > 0 ? (conversions * 80) / spend : 0;
    return { spend, impressions, clicks, conversions, reach, ctr, cpc, cpa, roas };
  }, [metrics]);

  const chartData = useMemo(
    () => metrics.map((m) => ({
      dia: new Date(m.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      Gasto: Number(m.spend || 0),
      Cliques: Number(m.clicks || 0),
    })),
    [metrics],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#EA3935]/30 border-t-[#EA3935] rounded-full animate-spin" />
      </div>
    );
  }

  if (!campanha) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-sm">Campanha não encontrada.</p>
        <Button onClick={onBack} variant="outline" className="mt-4 border-white/10 text-muted-foreground">
          Voltar
        </Button>
      </div>
    );
  }

  const platCfg = platformConfig[campanha.platform] ?? platformConfig.meta;
  const statCfg = statusConfig[campanha.status] ?? statusConfig.active;

  return (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para Campanhas
      </button>

      <div className="glass-card rounded-2xl border border-white/5 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-[#EA3935]/15 border border-[#EA3935]/60 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white tracking-tight truncate">{campanha.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border ${platformBadge[campanha.platform] ?? ''}`}>
                  {platCfg.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg border font-medium ${statCfg.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statCfg.dot}`} />
                  {statCfg.label}
                </span>
                {campanha.objective && (
                  <span className="text-xs text-muted-foreground">
                    {objectiveConfig[campanha.objective]?.label ?? campanha.objective}
                  </span>
                )}
              </div>
            </div>
          </div>

          {podeGerenciar && (
            <div className="flex items-center gap-2 shrink-0">
              <Button onClick={() => setShowEdit(true)} variant="outline" className="border-white/10 bg-transparent text-muted-foreground hover:text-white h-9">
                <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Editar
              </Button>
              {campanha.status === 'active' && (
                <Button onClick={() => setPausando(true)} variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200 hover:text-amber-100 hover:bg-amber-500/20 h-9">
                  <Pause className="w-3.5 h-3.5 mr-1.5" /> Pausar
                </Button>
              )}
              {campanha.status === 'paused' && (
                <Button onClick={() => mudarStatus.mutate('active')} variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:text-emerald-100 hover:bg-emerald-500/20 h-9">
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Reativar
                </Button>
              )}
              {campanha.status !== 'ended' && (
                <Button onClick={() => setEncerrando(true)} variant="outline" className="border-red-500/30 bg-red-500/10 text-red-200 hover:text-red-100 hover:bg-red-500/20 h-9">
                  <Square className="w-3.5 h-3.5 mr-1.5" /> Encerrar
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Orçamento</p>
            <p className="text-sm text-white mt-1">
              {campanha.budget != null ? `${formatBRL(campanha.budget)} / ${campanha.budget_type === 'daily' ? 'dia' : 'total'}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Início</p>
            <p className="text-sm text-white mt-1">{campanha.start_date ? new Date(campanha.start_date).toLocaleDateString('pt-BR') : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Fim</p>
            <p className="text-sm text-white mt-1">{campanha.end_date ? new Date(campanha.end_date).toLocaleDateString('pt-BR') : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">ID externo</p>
            <p className="text-sm text-white mt-1 truncate" title={campanha.external_id || ''}>{campanha.external_id || '—'}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Métricas de performance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {metrics.length > 0
              ? `Período: ${metrics.length} dia(s)`
              : podeGerenciar
                ? 'Sem métricas — sincronize com a plataforma.'
                : 'Sem métricas registradas.'}
          </p>
        </div>
        {podeGerenciar && (
          <Button
            onClick={() => sincronizar.mutate()}
            disabled={sincronizar.isPending}
            className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${sincronizar.isPending ? 'animate-spin' : ''}`} />
            Sincronizar métricas
          </Button>
        )}
      </div>

      {metrics.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/5 p-12 text-center">
          <p className="text-muted-foreground text-sm">Nenhuma métrica registrada ainda.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetricCard icon={DollarSign} label="Gasto" value={formatBRL(agg.spend)} />
            <MetricCard icon={Eye} label="Impressões" value={formatInt(agg.impressions)} accent="text-sky-300" />
            <MetricCard icon={MousePointerClick} label="Cliques" value={formatInt(agg.clicks)} accent="text-violet-300" />
            <MetricCard icon={Percent} label="CTR" value={`${agg.ctr.toFixed(2)}%`} accent="text-amber-300" />
            <MetricCard icon={DollarSign} label="CPC" value={formatBRL(agg.cpc)} accent="text-emerald-300" />
            <MetricCard icon={Target} label="Conversões" value={formatInt(agg.conversions)} accent="text-emerald-300" />
            <MetricCard icon={DollarSign} label="CPA" value={formatBRL(agg.cpa)} accent="text-rose-300" />
            <MetricCard icon={TrendingUp} label="ROAS" value={`${agg.roas.toFixed(2)}x`} accent="text-emerald-400" />
            <MetricCard icon={Users} label="Alcance" value={formatInt(agg.reach)} accent="text-sky-300" />
          </div>

          <div className="glass-card rounded-2xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-white">Evolução diária</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Gasto e cliques por dia</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#EA3935' }} /> Gasto</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#f0706c' }} /> Cliques</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorGasto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EA3935" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EA3935" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCliques" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f0706c" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f0706c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Gasto" stroke="#EA3935" strokeWidth={2} fill="url(#colorGasto)" />
                <Area type="monotone" dataKey="Cliques" stroke="#f0706c" strokeWidth={2} fill="url(#colorCliques)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {showEdit && (
        <CampanhaForm
          campanha={campanha}
          isSaving={atualizar.isPending}
          onClose={() => setShowEdit(false)}
          onSave={(form) => atualizar.mutate(form)}
        />
      )}

      {pausando && (
        <ConfirmArchiveDialog
          title={`Pausar "${campanha.name}"?`}
          description="A campanha para de veicular na plataforma e pode ser reativada a qualquer momento."
          confirmLabel="Pausar campanha"
          loadingLabel="Pausando..."
          ConfirmIcon={Pause}
          tone="warning"
          onConfirm={() => mudarStatus.mutate('paused')}
          onCancel={() => setPausando(false)}
          isLoading={mudarStatus.isPending}
        />
      )}

      {encerrando && (
        <ConfirmArchiveDialog
          title={`Encerrar "${campanha.name}"?`}
          description="A campanha será encerrada na plataforma. O histórico permanece registrado aqui."
          confirmLabel="Encerrar campanha"
          loadingLabel="Encerrando..."
          ConfirmIcon={Square}
          tone="danger"
          onConfirm={() => mudarStatus.mutate('ended')}
          onCancel={() => setEncerrando(false)}
          isLoading={mudarStatus.isPending}
        />
      )}
    </div>
  );
}
