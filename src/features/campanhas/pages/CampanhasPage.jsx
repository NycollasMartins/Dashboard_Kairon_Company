import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Edit2,
  ArrowUpDown,
  Megaphone,
  Activity,
  DollarSign,
  Pause,
  Play,
  Square,
  Download,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import CampanhaForm from '@/features/campanhas/components/CampanhaForm';
import { campanhasApi } from '@/features/campanhas/api/campanhas.api';
import { getAdsService } from '@/lib/adsService';
import {
  statusConfig,
  platformConfig,
  platformBadge,
  formatBRL,
} from '@/features/campanhas/constants/campaignOptions';
import { queryKeys } from '@/entities/query-keys';

function StatCard({ icon: Icon, label, value, accent = 'text-[#EA3935]' }) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 p-6 hover:border-white/10 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-3.5 h-3.5 ${accent}`} />
        <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="text-4xl font-semibold text-white tracking-tight leading-none tabular-nums">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = statusConfig[status] ?? statusConfig.active;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg border font-medium ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function PlatformBadge({ platform }) {
  const cfg = platformConfig[platform] ?? platformConfig.meta;
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border ${platformBadge[platform] ?? ''}`}>
      {cfg.short}
    </span>
  );
}

const TABS = [
  { id: 'todas', label: 'Todas' },
  { id: 'active', label: 'Ativas' },
  { id: 'paused', label: 'Pausadas' },
  { id: 'ended', label: 'Encerradas' },
];

export default function CampanhasPage({ onVerCampanha }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [pausando, setPausando] = useState(null);
  const [encerrando, setEncerrando] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todas');
  const [filtroPlataforma, setFiltroPlataforma] = useState('todas');
  const { toast } = useToast();
  const { user } = useAuth();
  const podeGerenciar = user?.role === 'admin';
  const qc = useQueryClient();

  const { data: campanhas = [], isLoading } = useQuery({
    queryKey: queryKeys.campanhas.all,
    queryFn: campanhasApi.list,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.campanhas.all });

  const criar = useMutation({
    mutationFn: async (form) => {
      // Tenta registrar na plataforma (mock por padrão) para obter os ids externos.
      let external = {};
      try {
        external = await getAdsService(form.platform).createCampaign(form);
      } catch {
        // Falha de integração não bloqueia o cadastro local.
      }
      return campanhasApi.create({
        ...form,
        external_id: external.external_id ?? null,
        account_id: external.account_id ?? null,
        created_by: user?.id ?? null,
      });
    },
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      toast({ title: 'Campanha criada!' });
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Não foi possível criar a campanha', description: err?.message });
    },
  });

  const atualizar = useMutation({
    mutationFn: ({ id, data }) => campanhasApi.update(id, data),
    onSuccess: () => {
      invalidate();
      setEditando(null);
      toast({ title: 'Campanha atualizada!' });
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Não foi possível atualizar', description: err?.message });
    },
  });

  const mudarStatus = useMutation({
    mutationFn: async ({ campanha, novoStatus }) => {
      const service = getAdsService(campanha.platform);
      try {
        if (novoStatus === 'paused') await service.pauseCampaign(campanha.external_id);
        else if (novoStatus === 'ended') await service.endCampaign(campanha.external_id);
        else if (novoStatus === 'active') await service.resumeCampaign(campanha.external_id);
      } catch {
        // Mantém a mudança local mesmo se a API da plataforma falhar.
      }
      return campanhasApi.updateStatus(campanha.id, novoStatus);
    },
    onSuccess: (_data, vars) => {
      invalidate();
      setPausando(null);
      setEncerrando(null);
      const msg = vars.novoStatus === 'paused' ? 'Campanha pausada.'
        : vars.novoStatus === 'ended' ? 'Campanha encerrada.' : 'Campanha reativada.';
      toast({ title: msg });
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Não foi possível alterar o status', description: err?.message });
    },
  });

  // Importa campanhas reais da conta Meta e grava/atualiza no Supabase.
  const importar = useMutation({
    mutationFn: async () => {
      const remote = await getAdsService('meta').listCampaigns();
      const byExternal = new Map(
        campanhas.filter((c) => c.external_id).map((c) => [c.external_id, c]),
      );
      let novas = 0;
      let atualizadas = 0;
      for (const r of remote) {
        const existing = byExternal.get(r.external_id);
        if (existing) {
          await campanhasApi.update(existing.id, {
            name: r.name,
            status: r.status,
            objective: r.objective ?? existing.objective ?? null,
            budget: r.budget ?? null,
            budget_type: r.budget_type ?? 'daily',
            start_date: r.start_date ?? existing.start_date ?? null,
            end_date: r.end_date ?? existing.end_date ?? null,
            account_id: r.account_id ?? existing.account_id ?? null,
          });
          atualizadas += 1;
        } else {
          await campanhasApi.create({
            name: r.name,
            platform: 'meta',
            status: r.status,
            objective: r.objective ?? null,
            budget: r.budget ?? null,
            budget_type: r.budget_type ?? 'daily',
            start_date: r.start_date ?? null,
            end_date: r.end_date ?? null,
            external_id: r.external_id,
            account_id: r.account_id ?? null,
            created_by: user?.id ?? null,
          });
          novas += 1;
        }
      }
      return { novas, atualizadas };
    },
    onSuccess: (res) => {
      invalidate();
      toast({
        title: 'Importação concluída',
        description: `${res.novas} nova(s), ${res.atualizadas} atualizada(s).`,
      });
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Não foi possível importar do Meta', description: err?.message });
    },
  });

  // Sincroniza as métricas de TODAS as campanhas (com external_id) de uma vez.
  // Janela = início do ano até hoje (year-to-date), para alimentar o Financeiro
  // com o ano completo.
  const sincronizarMetricas = useMutation({
    mutationFn: async () => {
      const comId = campanhas.filter((c) => c.external_id);
      const hoje = new Date();
      const inicioAno = new Date(hoje.getFullYear(), 0, 1);
      const diasYTD = Math.floor((hoje - inicioAno) / 86400000) + 1;
      let ok = 0;
      let fail = 0;
      for (const c of comId) {
        try {
          const rows = await getAdsService(c.platform).getMetrics(c.external_id, { days: diasYTD });
          await campanhasApi.upsertMetrics(c.id, rows);
          ok += 1;
        } catch {
          fail += 1;
        }
      }
      return { ok, fail, total: comId.length };
    },
    onSuccess: (res) => {
      invalidate();
      qc.invalidateQueries({ queryKey: queryKeys.financeiro.metrics });
      if (res.total === 0) {
        toast({ title: 'Nada para sincronizar', description: 'Nenhuma campanha vinculada a uma plataforma (importe do Meta primeiro).' });
      } else {
        toast({
          title: 'Métricas sincronizadas',
          description: `${res.ok} campanha(s) atualizada(s)${res.fail ? `, ${res.fail} com erro` : ''}.`,
        });
      }
    },
    onError: (err) => {
      toast({ variant: 'destructive', title: 'Falha ao sincronizar métricas', description: err?.message });
    },
  });

  const handleSave = (form) => {
    if (editando) atualizar.mutate({ id: editando.id, data: form });
    else criar.mutate(form);
  };

  const stats = useMemo(() => {
    const ativas = campanhas.filter((c) => c.status === 'active').length;
    const investimento = campanhas
      .filter((c) => c.status === 'active' && c.budget)
      .reduce((sum, c) => sum + Number(c.budget || 0), 0);
    return { total: campanhas.length, ativas, investimento };
  }, [campanhas]);

  const filtered = campanhas
    .filter((c) => {
      const matchSearch = c.name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filtroStatus === 'todas' || c.status === filtroStatus;
      const matchPlat = filtroPlataforma === 'todas' || c.platform === filtroPlataforma;
      return matchSearch && matchStatus && matchPlat;
    });

  const handleRowClick = (id) => { if (onVerCampanha) onVerCampanha(id); };
  const handleRowKeyDown = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(id); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="-mt-24 -mx-6">
        <div
          className="relative h-44 rounded-b-3xl overflow-hidden"
          style={{
            backgroundImage: "url('/kairon-company-dark.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/75 pointer-events-none" />
        </div>

        <div className="px-6 -mt-10 relative">
          <div className="w-20 h-20 rounded-full bg-[#0d0d0d] border-2 border-white/10 flex items-center justify-center shadow-xl shadow-black/50">
            <Megaphone className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="px-6 mt-4">
          <h1 className="text-[1.7rem] font-bold text-white tracking-tight">Campanhas</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Gerencie e acompanhe suas campanhas de Meta Ads e Google Ads — orçamento, status e métricas de performance.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Megaphone} label="Total de campanhas" value={stats.total} accent="text-white" />
        <StatCard icon={Activity} label="Campanhas ativas" value={stats.ativas} accent="text-emerald-300" />
        <StatCard icon={DollarSign} label="Investimento ativo" value={formatBRL(stats.investimento)} accent="text-[#EA3935]" />
      </div>

      <div className="mt-16">
        <div className="flex flex-col gap-4 mb-5">
          <div className="flex items-center gap-6 border-b border-white/10">
            {TABS.map((tab) => {
              const active = filtroStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFiltroStatus(tab.id)}
                  className={`relative pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    active ? 'text-white border-[#EA3935]' : 'text-muted-foreground border-transparent hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Buscar campanha pelo nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none flex-1"
              />
            </div>
            <Select value={filtroPlataforma} onValueChange={setFiltroPlataforma}>
              <SelectTrigger className="w-full sm:w-44 bg-white/5 border-white/10 text-white">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                <SelectItem value="todas">Todas as plataformas</SelectItem>
                <SelectItem value="meta">Meta Ads</SelectItem>
                <SelectItem value="google">Google Ads</SelectItem>
              </SelectContent>
            </Select>
            {podeGerenciar && (
              <Button
                onClick={() => sincronizarMetricas.mutate()}
                disabled={sincronizarMetricas.isPending}
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/5 text-sm h-9 self-start sm:self-auto"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${sincronizarMetricas.isPending ? 'animate-spin' : ''}`} />
                {sincronizarMetricas.isPending ? 'Sincronizando...' : 'Sincronizar métricas'}
              </Button>
            )}
            {podeGerenciar && (
              <Button
                onClick={() => importar.mutate()}
                disabled={importar.isPending}
                variant="outline"
                className="border-white/10 bg-transparent text-white hover:bg-white/5 text-sm h-9 self-start sm:self-auto"
              >
                <Download className={`w-4 h-4 mr-1.5 ${importar.isPending ? 'animate-pulse' : ''}`} />
                {importar.isPending ? 'Importando...' : 'Importar do Meta'}
              </Button>
            )}
            {podeGerenciar && (
              <Button
                onClick={() => setShowForm(true)}
                className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm h-9 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Nova Campanha
              </Button>
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#EA3935]/30 border-t-[#EA3935] rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground text-sm">Nenhuma campanha encontrada.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[minmax(0,2fr)_110px_minmax(0,1.3fr)_140px_120px_110px] gap-4 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/5 bg-white/[0.02]">
                <div>Campanha</div>
                <div>Plataforma</div>
                <div>Objetivo</div>
                <div>Orçamento</div>
                <div>Status</div>
                <div className="text-right">Ações</div>
              </div>

              <div className="divide-y divide-white/5">
                {filtered.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(c.id)}
                    onKeyDown={(e) => handleRowKeyDown(e, c.id)}
                    className="group cursor-pointer hover:bg-white/[0.03] transition-colors focus:outline-none focus:bg-white/[0.04]"
                  >
                    <div className="md:grid md:grid-cols-[minmax(0,2fr)_110px_minmax(0,1.3fr)_140px_120px_110px] gap-4 px-5 py-4 flex flex-col">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#EA3935]/15 border border-[#EA3935]/60 flex items-center justify-center shrink-0">
                          <Megaphone className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                      </div>

                      <div className="flex items-center">
                        <PlatformBadge platform={c.platform} />
                      </div>

                      <div className="flex items-center min-w-0">
                        <span className="text-sm text-white/80 truncate capitalize">
                          {c.objective ? c.objective.replace('_', ' ') : '—'}
                        </span>
                      </div>

                      <div className="flex items-center">
                        {c.budget != null ? (
                          <span className="text-sm text-white/90 tabular-nums">
                            {formatBRL(c.budget)}
                            <span className="text-[11px] text-muted-foreground ml-1">
                              /{c.budget_type === 'daily' ? 'dia' : 'total'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </div>

                      <div className="flex items-center">
                        <StatusBadge status={c.status} />
                      </div>

                      <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                        {podeGerenciar ? (
                          <>
                            <button
                              onClick={() => setEditando(c)}
                              title="Editar campanha"
                              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {c.status === 'active' && (
                              <button
                                onClick={() => setPausando(c)}
                                title="Pausar campanha"
                                className="p-1.5 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-300 transition-colors"
                              >
                                <Pause className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {c.status === 'paused' && (
                              <button
                                onClick={() => mudarStatus.mutate({ campanha: c, novoStatus: 'active' })}
                                title="Reativar campanha"
                                className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-300 transition-colors"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {c.status !== 'ended' && (
                              <button
                                onClick={() => setEncerrando(c)}
                                title="Encerrar campanha"
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-300 transition-colors"
                              >
                                <Square className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {(showForm || editando) && (
        <CampanhaForm
          campanha={editando}
          isSaving={criar.isPending || atualizar.isPending}
          onClose={() => { setShowForm(false); setEditando(null); }}
          onSave={handleSave}
        />
      )}

      {pausando && (
        <ConfirmArchiveDialog
          title={`Pausar "${pausando.name}"?`}
          description="A campanha para de veicular na plataforma e pode ser reativada a qualquer momento. As métricas já coletadas são preservadas."
          confirmLabel="Pausar campanha"
          loadingLabel="Pausando..."
          ConfirmIcon={Pause}
          tone="warning"
          onConfirm={() => mudarStatus.mutate({ campanha: pausando, novoStatus: 'paused' })}
          onCancel={() => setPausando(null)}
          isLoading={mudarStatus.isPending}
        />
      )}

      {encerrando && (
        <ConfirmArchiveDialog
          title={`Encerrar "${encerrando.name}"?`}
          description="A campanha será encerrada na plataforma. Esta ação não pode ser revertida pela própria plataforma, mas o histórico permanece registrado aqui."
          confirmLabel="Encerrar campanha"
          loadingLabel="Encerrando..."
          ConfirmIcon={Square}
          tone="danger"
          onConfirm={() => mudarStatus.mutate({ campanha: encerrando, novoStatus: 'ended' })}
          onCancel={() => setEncerrando(null)}
          isLoading={mudarStatus.isPending}
        />
      )}
    </div>
  );
}
