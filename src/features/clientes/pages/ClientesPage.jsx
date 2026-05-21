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
  ChevronRight,
  Users as UsersIcon,
  UserCheck,
  ClipboardList,
  Filter,
  ArrowUpRight,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import ClienteForm from '@/features/clientes/components/ClienteForm';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { tarefasApi } from '@/features/tarefas/api/tarefas.api';
import { queryKeys } from '@/entities/query-keys';

const statusConfig = {
  lead: { label: 'Lead', color: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-400' },
  qualificado: { label: 'Qualificado', color: 'text-purple-300', bg: 'bg-purple-500/10 border-purple-500/20', dot: 'bg-purple-400' },
  ativo: { label: 'Ativo', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
  inativo: { label: 'Inativo', color: 'text-slate-300', bg: 'bg-slate-500/10 border-slate-500/20', dot: 'bg-slate-400' },
};

function StatCard({ icon: Icon, label, value, trend, trendLabel, accent = 'text-[#EA3935]', bgAccent = 'bg-[#EA3935]/10' }) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 p-5 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgAccent}`}>
          <Icon className={`w-4 h-4 ${accent}`} />
        </div>
        {trend != null && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2 py-0.5">
            <ArrowUpRight className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-white tracking-tight">{value}</p>
        {trendLabel && <p className="text-[11px] text-muted-foreground">{trendLabel}</p>}
      </div>
    </div>
  );
}

export default function ClientesPage({ onVerCliente }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [arquivando, setArquivando] = useState(null);
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
      toast({ title: 'Cliente arquivado.' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível arquivar o cliente',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  const handleSave = (form) => {
    if (editando) atualizar.mutate({ id: editando.id, data: form });
    else criar.mutate(form);
  };

  const stats = useMemo(() => {
    const total = clientes.length;
    const ativos = clientes.filter((c) => c.status === 'ativo').length;
    const leads = clientes.filter((c) => c.status === 'lead' || c.status === 'qualificado').length;
    return { total, ativos, leads };
  }, [clientes]);

  const filtered = clientes
    .filter((c) => {
      const matchSearch =
        c.nome?.toLowerCase().includes(search.toLowerCase()) ||
        c.empresa?.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        filtroStatus === 'todos' ||
        (filtroStatus === 'ativos' && c.status !== 'inativo') ||
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

  const getTarefasPendentes = (clienteId) =>
    tarefas.filter((t) => t.cliente_id === clienteId && t.status !== 'concluida');

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={UsersIcon}
          label="Total de clientes"
          value={stats.total}
          trend={stats.total > 0 ? `${Math.round((stats.ativos / Math.max(stats.total, 1)) * 100)}%` : null}
          trendLabel="ativos"
          accent="text-[#EA3935]"
          bgAccent="bg-[#EA3935]/10"
        />
        <StatCard
          icon={UserCheck}
          label="Clientes ativos"
          value={stats.ativos}
          accent="text-emerald-300"
          bgAccent="bg-emerald-500/10"
        />
        <StatCard
          icon={ClipboardList}
          label="Leads em pipeline"
          value={stats.leads}
          accent="text-blue-300"
          bgAccent="bg-blue-500/10"
        />
      </div>

      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="flex flex-col gap-3 p-5 border-b border-white/5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Clientes <span className="text-muted-foreground font-normal">({filtered.length})</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Gerencie sua carteira, acompanhe status e tarefas pendentes.
              </p>
            </div>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm h-9 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Novo Cliente
            </Button>
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
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full sm:w-44 bg-white/5 border-white/10 text-white">
                <Filter className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                <SelectItem value="ativos">Ativos</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="qualificado">Qualificado</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground text-sm">Nenhum cliente encontrado.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[minmax(0,2fr)_140px_minmax(0,1.4fr)_160px_120px] gap-4 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/5 bg-white/[0.02]">
              <div>Cliente</div>
              <div>Status</div>
              <div>Empresa</div>
              <div>Tarefas pendentes</div>
              <div className="text-right">Ações</div>
            </div>

            <div className="divide-y divide-white/5">
              {filtered.map((c, i) => {
                const cfg = statusConfig[c.status] || statusConfig.lead;
                const pendentes = getTarefasPendentes(c.id);
                const pendentesTotal = pendentes.length;
                const pendentesPct = Math.min(100, pendentesTotal * 20);
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
                    <div className="md:grid md:grid-cols-[minmax(0,2fr)_140px_minmax(0,1.4fr)_160px_120px] gap-4 px-5 py-4 flex flex-col">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0"
                          style={{ background: 'rgba(234, 57, 53, 0.2)' }}
                        >
                          {c.nome?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate group-hover:text-white">
                            {c.nome}
                          </p>
                          {c.email && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3 shrink-0" /> {c.email}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg border font-medium ${cfg.bg} ${cfg.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
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
                        {pendentesTotal > 0 ? (
                          <>
                            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden max-w-[100px]">
                              <div
                                className="h-full bg-[#EA3935] rounded-full"
                                style={{ width: `${pendentesPct}%` }}
                              />
                            </div>
                            <span className="text-xs text-white font-medium shrink-0">
                              {pendentesTotal}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">Nenhuma</span>
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
                        {c.status !== 'inativo' && (
                          <button
                            onClick={() => setArquivando(c)}
                            title="Arquivar cliente"
                            className="p-1.5 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-300 transition-colors"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-white group-hover:translate-x-0.5 transition-all ml-1" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
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
          title={`Arquivar ${arquivando.nome}?`}
          description="O cliente fica oculto da lista e suas tarefas somem do Kanban. O histórico é preservado e você pode reativar a qualquer momento mudando o status para Ativo."
          onConfirm={() => arquivar.mutate(arquivando.id)}
          onCancel={() => setArquivando(null)}
          isLoading={arquivar.isPending}
        />
      )}
    </div>
  );
}
