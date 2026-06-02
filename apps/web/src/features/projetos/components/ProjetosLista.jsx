import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, X, Check, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { projetosApi } from '@/features/projetos/api/projetos.api';
import { tarefasApi } from '@/features/tarefas/api/tarefas.api';
import { queryKeys } from '@/entities/query-keys';

const statusConfig = {
  ativo: {
    label: 'Em desenvolvimento',
    pill: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    avatarBg: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
    bar: 'bg-blue-400',
  },
  pausado: {
    label: 'Em revisão',
    pill: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    avatarBg: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
    bar: 'bg-amber-400',
  },
  concluido: {
    label: 'Concluído',
    pill: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
    avatarBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
    bar: 'bg-emerald-400',
  },
};

const AVATAR_PALETTE = [
  'bg-rose-500',
  'bg-blue-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-indigo-500',
];

function projetoInitials(nome) {
  if (!nome) return '?';
  const words = nome.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}

function userInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function colorForId(id) {
  if (!id) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function formatPrazo(iso, status) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const dia = d.getUTCDate();
    const mes = d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '');
    const prefix = status === 'concluido' ? 'concluído' : 'entrega';
    return `${prefix} ${dia} ${mes}`;
  } catch {
    return null;
  }
}

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
                <SelectItem value="ativo">Em desenvolvimento</SelectItem>
                <SelectItem value="pausado">Em revisão</SelectItem>
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

function ProjetoCard({ projeto, tarefas, onOpen, onEdit, onDelete }) {
  const cfg = statusConfig[projeto.status] || statusConfig.ativo;
  const concluidas = tarefas.filter((t) => t.status === 'concluida').length;
  const total = tarefas.length;
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : (projeto.status === 'concluido' ? 100 : 0);

  const responsaveisMap = new Map();
  for (const t of tarefas) {
    const r = t.responsavel;
    if (r?.id && !responsaveisMap.has(r.id)) responsaveisMap.set(r.id, r);
  }
  const responsaveis = Array.from(responsaveisMap.values()).slice(0, 4);
  const extras = responsaveisMap.size - responsaveis.length;

  const prazoLabel = formatPrazo(projeto.prazo, projeto.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onOpen}
      className="glass-card border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all group cursor-pointer flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`w-11 h-11 rounded-xl border flex items-center justify-center text-sm font-bold tracking-tight ${cfg.avatarBg}`}>
          {projetoInitials(projeto.nome)}
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-xs px-2.5 py-1 rounded-full border font-medium whitespace-nowrap ${cfg.pill}`}>
            {cfg.label}
          </span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
              aria-label="Editar projeto"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
              aria-label="Remover projeto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 flex-1">
        <h3 className="text-base font-semibold text-white leading-tight">{projeto.nome}</h3>
        {projeto.descricao && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{projeto.descricao}</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${cfg.bar}`} style={{ width: `${progresso}%` }} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex -space-x-1.5">
            {responsaveis.length > 0 ? responsaveis.map((u) => (
              <div
                key={u.id}
                title={u.full_name}
                className={`w-6 h-6 rounded-full ${colorForId(u.id)} flex items-center justify-center text-[10px] font-semibold text-white border-2 border-[#0a0a0f]`}
              >
                {userInitials(u.full_name)}
              </div>
            )) : (
              <span className="text-[11px] text-muted-foreground italic">Sem responsáveis</span>
            )}
            {extras > 0 && (
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-semibold text-muted-foreground border-2 border-[#0a0a0f]">
                +{extras}
              </div>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 shrink-0">
            <span className="text-white font-semibold">{progresso}%</span>
            {prazoLabel && <span>· {prazoLabel}</span>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function NovoProjetoCard({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-dashed border-white/10 hover:border-[#EA3935]/40 bg-white/[0.015] hover:bg-[#EA3935]/[0.04] transition-all flex flex-col items-center justify-center gap-2 p-8 min-h-[220px] group"
    >
      <div className="w-11 h-11 rounded-full border border-white/10 group-hover:border-[#EA3935]/40 flex items-center justify-center text-muted-foreground group-hover:text-[#EA3935] transition-colors">
        <Plus className="w-5 h-5" />
      </div>
      <p className="text-sm font-medium text-white">Novo Projeto</p>
      <p className="text-xs text-muted-foreground text-center max-w-[220px]">
        Criar projeto associado a este cliente
      </p>
    </button>
  );
}

export default function ProjetosLista({ clienteId, sectionIndex = 2, onVerProjeto }) {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
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

  const sectionNumber = String(sectionIndex).padStart(2, '0');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-0.5 h-5 rounded-full bg-[#EA3935]" />
          <span className="text-xs font-mono text-muted-foreground tracking-wider">{sectionNumber}</span>
        </div>
        <h2 className="text-lg font-semibold text-white">Projetos do Cliente</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projetos.map((projeto) => (
          <ProjetoCard
            key={projeto.id}
            projeto={projeto}
            tarefas={todasTarefas.filter((t) => t.projeto_id === projeto.id)}
            onOpen={() => onVerProjeto?.(projeto)}
            onEdit={() => setEditando(projeto)}
            onDelete={() => deletar.mutate(projeto.id)}
          />
        ))}
        <NovoProjetoCard onClick={() => setShowForm(true)} />
      </div>

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
