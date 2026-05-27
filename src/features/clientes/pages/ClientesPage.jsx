import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Edit2,
  Archive,
  Phone,
  Mail,
  Building2,
  Users,
  UserCheck,
  UserPlus,
  ArrowUpDown,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import ClienteForm from '@/features/clientes/components/ClienteForm';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { tarefasApi } from '@/features/tarefas/api/tarefas.api';
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

export default function ClientesPage({ onVerCliente }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [arquivando, setArquivando] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('ativos');
  const [ordenacao, setOrdenacao] = useState('nome-asc');
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: clientes = [] } = useQuery({
    queryKey: queryKeys.clientes.all,
    queryFn: clientesApi.list,
  });

  const { data: tarefas = [] } = useQuery({
    queryKey: queryKeys.tarefas.all,
    queryFn: tarefasApi.list,
  });

  const criar = useMutation({
    mutationFn: clientesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clientes.all });
      setShowForm(false);
      toast({ title: 'Cliente adicionado!' });
    },
  });

  const atualizar = useMutation({
    mutationFn: ({ id, data }) => clientesApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clientes.all });
      setEditando(null);
      toast({ title: 'Cliente atualizado!' });
    },
  });

  const arquivar = useMutation({
    mutationFn: clientesApi.archive,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clientes.all });
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.all });
      setArquivando(null);
      toast({ title: 'Cliente marcado como churn.' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível arquivar o cliente',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  const excluir = useMutation({
    mutationFn: clientesApi.remove,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clientes.all });
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.all });
      qc.invalidateQueries({ queryKey: queryKeys.projetos.all });
      qc.invalidateQueries({ queryKey: queryKeys.contratos.all });
      qc.invalidateQueries({ queryKey: queryKeys.leads.all });
      setExcluindo(null);
      toast({ title: 'Cliente excluído permanentemente.' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível excluir o cliente',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  const handleSave = (form) => {
    if (editando) atualizar.mutate({ id: editando.id, data: form });
    else criar.mutate(form);
  };

  const stats = useMemo(() => {
    const ativos = clientes.filter((c) => c.status === 'ativo').length;
    const agora = new Date();
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const inicioProximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
    const dentroDoMes = (iso) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d >= inicioMes && d < inicioProximoMes;
    };
    const ativosNoMes = clientes.filter(
      (c) => c.status === 'ativo' && dentroDoMes(c.created_at),
    ).length;
    const churnsMes = clientes.filter(
      (c) => c.status === 'churn' && dentroDoMes(c.churned_at),
    ).length;
    return { ativos, ativosNoMes, churnsMes };
  }, [clientes]);

  const filtered = clientes
    .filter((c) => {
      const matchSearch =
        c.nome?.toLowerCase().includes(search.toLowerCase()) ||
        c.empresa?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        filtroStatus === 'todos' ||
        (filtroStatus === 'ativos' && c.status !== 'churn') ||
        c.status === filtroStatus;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      switch (ordenacao) {
        case 'nome-desc':
          return (b.nome ?? '').localeCompare(a.nome ?? '', 'pt-BR');
        case 'recentes':
          return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
        case 'antigos':
          return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
        case 'nome-asc':
        default:
          return (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR');
      }
    });

  const handleRowClick = (id) => {
    if (onVerCliente) onVerCliente(id);
  };

  const handleRowKeyDown = (e, id) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(id);
    }
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
            <Users className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="px-6 mt-4">
          <h1 className="text-[1.7rem] font-bold text-white tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Gerencie sua carteira de clientes, acompanhe contratos, churn no mês e tarefas pendentes de cada conta.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={UserCheck}
          label="Total de clientes ativos"
          value={stats.ativos}
          accent="text-emerald-300"
        />
        <StatCard
          icon={UserPlus}
          label="Clientes ativos no mês"
          value={stats.ativosNoMes}
          accent="text-[#EA3935]"
        />
        <StatCard
          icon={Archive}
          label="Churns no mês"
          value={stats.churnsMes}
          accent="text-slate-300"
        />
      </div>

      <div className="mt-16">
        <div className="flex flex-col gap-4 mb-5">
          <div className="flex items-center gap-6 border-b border-white/10">
            {[
              { id: 'ativos', label: 'Ativos' },
              { id: 'churn', label: 'Churn' },
            ].map((tab) => {
              const active = filtroStatus === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFiltroStatus(tab.id)}
                  className={`relative pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    active
                      ? 'text-white border-[#EA3935]'
                      : 'text-muted-foreground border-transparent hover:text-white'
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
                placeholder="Buscar por nome, empresa ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none flex-1"
              />
            </div>
            <Select value={ordenacao} onValueChange={setOrdenacao}>
              <SelectTrigger className="w-full sm:w-48 bg-white/5 border-white/10 text-white">
                <ArrowUpDown className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                <SelectItem value="nome-asc">Nome (A-Z)</SelectItem>
                <SelectItem value="nome-desc">Nome (Z-A)</SelectItem>
                <SelectItem value="recentes">Mais recentes</SelectItem>
                <SelectItem value="antigos">Mais antigos</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm h-9 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo Cliente
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground text-sm">Nenhum cliente encontrado.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_180px_140px_110px] gap-4 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/5 bg-white/[0.02]">
              <div>Cliente</div>
              <div>Empresa</div>
              <div>Onboarding</div>
              <div>Contrato</div>
              <div className="text-right">Ações</div>
            </div>

            <div className="divide-y divide-white/5">
              {filtered.map((c, i) => {
                const onboardingTasks = tarefas.filter(
                  (t) => t.cliente_id === c.id && t.projetos?.nome === 'Onboarding',
                );
                const onboardingTotal = onboardingTasks.length;
                const onboardingDone = onboardingTasks.filter((t) => t.status === 'concluida').length;
                const onboardingPct = onboardingTotal > 0
                  ? Math.round((onboardingDone / onboardingTotal) * 100)
                  : 0;
                const contratoAtivo = c.contratos?.find((co) => co.status === 'ativo') ?? null;
                const expiraEsteMes = (() => {
                  if (!contratoAtivo?.data_fim) return false;
                  const fim = new Date(contratoAtivo.data_fim);
                  const agora = new Date();
                  return (
                    fim.getFullYear() === agora.getFullYear() &&
                    fim.getMonth() === agora.getMonth()
                  );
                })();
                return (
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
                    <div className="md:grid md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_180px_140px_110px] gap-4 px-5 py-4 flex flex-col">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#EA3935]/15 border border-[#EA3935]/60 flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-md shadow-black/40">
                          {c.nome?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm font-semibold text-white truncate group-hover:text-white">
                              {c.nome}
                            </p>
                            {c.origem === 'lead' && (
                              <span
                                title="Cliente convertido a partir de um Lead"
                                className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/25"
                              >
                                Lead
                              </span>
                            )}
                          </div>
                          {c.email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3 shrink-0" /> {c.email}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center min-w-0">
                        {c.empresa ? (
                          <p className="text-sm text-white/80 flex items-center gap-1.5 truncate">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{c.empresa}</span>
                          </p>
                        ) : c.telefone ? (
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 shrink-0" /> {c.telefone}
                          </p>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 min-w-0">
                        {onboardingTotal > 0 ? (
                          <>
                            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden max-w-[110px]">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  onboardingPct === 100 ? 'bg-emerald-400' : 'bg-[#EA3935]'
                                }`}
                                style={{ width: `${onboardingPct}%` }}
                              />
                            </div>
                            <span className="text-xs text-white font-medium shrink-0 tabular-nums">
                              {onboardingDone}/{onboardingTotal}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </div>

                      <div className="flex items-center">
                        {!contratoAtivo ? (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg border font-medium bg-amber-500/10 border-amber-500/20 text-amber-300">
                            <AlertCircle className="w-3 h-3" />
                            Pendente
                          </span>
                        ) : expiraEsteMes ? (
                          <span
                            title={`Vence em ${new Date(contratoAtivo.data_fim).toLocaleDateString('pt-BR')}`}
                            className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg border font-medium bg-red-500/10 border-red-500/20 text-red-300"
                          >
                            <Clock className="w-3 h-3" />
                            Expira {new Date(contratoAtivo.data_fim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg border font-medium bg-emerald-500/10 border-emerald-500/20 text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            OK
                          </span>
                        )}
                      </div>

                      <div
                        className="flex items-center gap-1 justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setEditando(c)}
                          title="Editar cliente"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {c.status !== 'churn' && (
                          <button
                            onClick={() => setArquivando(c)}
                            title="Marcar como churn"
                            className="p-1.5 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-300 transition-colors"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {c.status === 'churn' && (
                          <button
                            onClick={() => setExcluindo(c)}
                            title="Excluir cliente permanentemente"
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
        </div>
      </div>

      {(showForm || editando) && (
        <ClienteForm
          cliente={editando}
          onClose={() => { setShowForm(false); setEditando(null); }}
          onSave={handleSave}
        />
      )}

      {arquivando && (
        <ConfirmArchiveDialog
          title={`Marcar ${arquivando.nome} como churn?`}
          description="O cliente sai da carteira ativa e suas tarefas somem do Kanban. O histórico é preservado e você pode reativar a qualquer momento mudando o status para Ativo."
          confirmLabel="Marcar churn"
          onConfirm={() => arquivar.mutate(arquivando.id)}
          onCancel={() => setArquivando(null)}
          isLoading={arquivar.isPending}
        />
      )}

      {excluindo && (
        <ConfirmArchiveDialog
          title={`Excluir ${excluindo.nome} permanentemente?`}
          description="Esta ação é irreversível. O cliente, seus contratos, tarefas e todo o histórico associado serão apagados em definitivo."
          confirmLabel="Excluir definitivamente"
          loadingLabel="Excluindo..."
          ConfirmIcon={Trash2}
          tone="danger"
          onConfirm={() => excluir.mutate(excluindo.id)}
          onCancel={() => setExcluindo(null)}
          isLoading={excluir.isPending}
        />
      )}
    </div>
  );
}
