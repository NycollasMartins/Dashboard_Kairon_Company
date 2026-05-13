import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, X, Check, Calendar, Folder, ChevronRight, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import ProjetoKanban from '@/features/projetos/components/ProjetoKanban';
import { projetosApi } from '@/features/projetos/api/projetos.api';
import { tarefasApi } from '@/features/tarefas/api/tarefas.api';
import { queryKeys } from '@/entities/query-keys';

const statusConfig = {
  ativo: { label: 'Ativo', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  pausado: { label: 'Pausado', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  concluido: { label: 'Concluído', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
};

function ProjetoForm({ onClose, onSave, clienteId, projeto }) {
  const [form, setForm] = useState({
    nome: projeto?.nome ?? '',
    descricao: projeto?.descricao ?? '',
    status: projeto?.status ?? 'ativo',
    prazo: projeto?.prazo ?? '',
    cliente_id: clienteId,
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative glass-card border border-white/10 rounded-2xl p-6 w-full max-w-md z-10"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">{projeto ? 'Editar Projeto' : 'Novo Projeto'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <Input
            placeholder="Nome do projeto *"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
          />
          <Input
            placeholder="Descrição (opcional)"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={form.prazo}
              onChange={(e) => setForm({ ...form, prazo: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button onClick={onClose} variant="outline" className="flex-1 border-white/10 text-muted-foreground">Cancelar</Button>
            <Button
              type="button"
              disabled={!form.nome.trim()}
              onClick={() => {
                const nome = form.nome.trim();
                if (!nome) return;
                onSave({ ...form, nome });
              }}
              className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white"
            >
              <Check className="w-4 h-4 mr-1" /> {projeto ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function ProjetosLista({ clienteId, clienteNome, squadMembros = [] }) {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [projetoSelecionado, setProjetoSelecionado] = useState(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: projetos = [] } = useQuery({
    queryKey: queryKeys.projetos.byCliente(clienteId),
    queryFn: () => projetosApi.byCliente(clienteId),
    enabled: !!clienteId,
  });

  const { data: todasTarefas = [] } = useQuery({
    queryKey: queryKeys.tarefas.byCliente(clienteId),
    queryFn: () => tarefasApi.byCliente(clienteId),
    enabled: !!clienteId,
  });

  const criar = useMutation({
    mutationFn: projetosApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projetos.byCliente(clienteId) });
      setShowForm(false);
      toast({ title: 'Projeto criado!' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível criar o projeto',
        description: err?.message ?? 'Tente novamente.',
      });
    },
  });

  const atualizar = useMutation({
    mutationFn: ({ id, data }) => projetosApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projetos.byCliente(clienteId) });
      setEditando(null);
      toast({ title: 'Projeto atualizado!' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível atualizar o projeto',
        description: err?.message ?? 'Tente novamente.',
      });
    },
  });

  const deletar = useMutation({
    mutationFn: projetosApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projetos.byCliente(clienteId) });
      toast({ title: 'Projeto removido.' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível remover o projeto',
        description: err?.message ?? 'Tente novamente.',
      });
    },
  });

  if (projetoSelecionado) {
    return (
      <ProjetoKanban
        projeto={projetoSelecionado}
        clienteNome={clienteNome}
        squadMembros={squadMembros}
        onBack={() => setProjetoSelecionado(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <Folder className="w-4 h-4 text-[#EA3935]" />
          Projetos
          <span className="text-xs text-muted-foreground font-normal">({projetos.length})</span>
        </p>
        <Button onClick={() => setShowForm(true)} className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-xs h-8 px-3">
          <Plus className="w-3.5 h-3.5 mr-1" /> Novo Projeto
        </Button>
      </div>

      {projetos.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/5 p-10 flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
            <Folder className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-white">Nenhum projeto ainda</p>
          <p className="text-xs text-muted-foreground">Crie o primeiro projeto para este cliente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projetos.map((projeto) => {
            const cfg = statusConfig[projeto.status] || statusConfig.ativo;
            const tarefasDoProjeto = todasTarefas.filter((t) => t.projeto_id === projeto.id);
            const concluidas = tarefasDoProjeto.filter((t) => t.status === 'concluida').length;

            return (
              <motion.div
                key={projeto.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:border-white/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EA3935]/10 flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5 text-[#EA3935]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-white truncate">{projeto.nome}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-lg border font-medium shrink-0 ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {projeto.descricao && <p className="text-xs text-muted-foreground truncate">{projeto.descricao}</p>}
                    <span className="text-xs text-muted-foreground shrink-0">
                      {concluidas}/{tarefasDoProjeto.length} tarefas
                    </span>
                    {projeto.prazo && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Calendar className="w-3 h-3" />{projeto.prazo}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditando(projeto); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deletar.mutate(projeto.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setProjetoSelecionado(projeto)}
                    className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProjetoForm
          onClose={() => setShowForm(false)}
          onSave={(f) => criar.mutate({ ...f, cliente_id: clienteId })}
          clienteId={clienteId}
        />
      )}

      {editando && (
        <ProjetoForm
          projeto={editando}
          onClose={() => setEditando(null)}
          onSave={(f) => atualizar.mutate({ id: editando.id, data: f })}
          clienteId={clienteId}
        />
      )}
    </div>
  );
}
