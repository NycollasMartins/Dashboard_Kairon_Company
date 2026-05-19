import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Archive, Phone, Mail, Building2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import ClienteForm from '@/features/clientes/components/ClienteForm';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { tarefasApi } from '@/features/tarefas/api/tarefas.api';
import { queryKeys } from '@/entities/query-keys';

const statusConfig = {
  lead: { label: 'Lead', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  qualificado: { label: 'Qualificado', color: 'text-[#EA3935]', bg: 'bg-purple-500/10 border-purple-500/20' },
  ativo: { label: 'Ativo', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  inativo: { label: 'Inativo', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
};

export default function ClientesPage({ onVerCliente }) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [arquivando, setArquivando] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('ativos');
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

  const filtered = clientes.filter((c) => {
    const matchSearch =
      c.nome?.toLowerCase().includes(search.toLowerCase()) ||
      c.empresa?.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filtroStatus === 'todos' ||
      (filtroStatus === 'ativos' && c.status !== 'inativo') ||
      c.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  const getTarefasPendentes = (clienteId) =>
    tarefas.filter((t) => t.cliente_id === clienteId && t.status !== 'concluida');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 glass-card rounded-xl px-3 py-2 border border-white/5">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none flex-1"
          />
        </div>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-36 bg-white/5 border-white/10 text-white">
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
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm h-9"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Novo Cliente
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/5 p-12 text-center">
          <p className="text-muted-foreground text-sm">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c, i) => {
            const cfg = statusConfig[c.status] || statusConfig.lead;
            const pendentes = getTarefasPendentes(c.id);
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass-card rounded-2xl border border-white/5 p-5 hover:border-white/10 transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0"
                      style={{ background: 'rgba(234, 57, 53,0.2)' }}
                    >
                      {c.nome?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{c.nome}</p>
                      {c.empresa && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 shrink-0" /> {c.empresa}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-lg border font-medium shrink-0 ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>

                <div className="space-y-1.5 mb-4">
                  {c.email && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
                      <Mail className="w-3 h-3 shrink-0" /> {c.email}
                    </p>
                  )}
                  {c.telefone && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Phone className="w-3 h-3 shrink-0" /> {c.telefone}
                    </p>
                  )}
                </div>

                {pendentes.length > 0 && (
                  <p className="text-xs text-red-400 mb-3">
                    {pendentes.length} tarefa{pendentes.length > 1 ? 's' : ''} pendente{pendentes.length > 1 ? 's' : ''}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                  <button
                    onClick={() => setEditando(c)}
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
                  {onVerCliente && (
                    <button
                      onClick={() => onVerCliente(c.id)}
                      className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors"
                    >
                      Ver detalhes <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

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
