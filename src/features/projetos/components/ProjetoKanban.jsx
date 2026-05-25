import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import {
  Plus, X, Check, Calendar, ArrowLeft, Trash2,
  FolderKanban, CalendarDays, ListChecks, Briefcase, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { tarefasApi } from '@/features/tarefas/api/tarefas.api';
import { projetosApi } from '@/features/projetos/api/projetos.api';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { queryKeys } from '@/entities/query-keys';

const columns = [
  { id: 'pendente', label: 'Pendente', color: 'text-slate-400', border: 'border-slate-500/30', accent: 'bg-slate-500/10' },
  { id: 'em_andamento', label: 'Em Andamento', color: 'text-blue-400', border: 'border-blue-500/30', accent: 'bg-blue-500/10' },
  { id: 'revisao', label: 'Revisão', color: 'text-yellow-400', border: 'border-yellow-500/30', accent: 'bg-yellow-500/10' },
  { id: 'concluida', label: 'Concluída', color: 'text-emerald-400', border: 'border-emerald-500/30', accent: 'bg-emerald-500/10' },
];

const prioridadeConfig = {
  baixa:    { label: 'Baixa',    color: 'text-slate-300', dot: 'bg-slate-400' },
  media:    { label: 'Média',    color: 'text-blue-300',  dot: 'bg-blue-400' },
  alta:     { label: 'Alta',     color: 'text-amber-300', dot: 'bg-amber-400' },
  urgente:  { label: 'Urgente',  color: 'text-red-300',   dot: 'bg-red-400' },
};

const tagPalette = [
  { bg: 'rgba(234,57,53,0.12)', fg: '#EA3935' },
  { bg: 'rgba(59,130,246,0.14)', fg: '#60A5FA' },
  { bg: 'rgba(16,185,129,0.14)', fg: '#34D399' },
  { bg: 'rgba(168,85,247,0.14)', fg: '#C084FC' },
  { bg: 'rgba(245,158,11,0.14)', fg: '#FBBF24' },
  { bg: 'rgba(236,72,153,0.14)', fg: '#F472B6' },
];

function tagColorFor(key) {
  if (!key) return tagPalette[0];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return tagPalette[h % tagPalette.length];
}

function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, size = 20, muted = false }) {
  const color = tagColorFor(name);
  const style = muted
    ? { width: size, height: size, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)' }
    : { width: size, height: size, background: color.bg, color: color.fg };
  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold shrink-0"
      style={style}
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}

function PrazoBadge({ prazo, status }) {
  if (!prazo) return null;
  const concluida = status === 'concluida';
  const today = todayStr();
  const atrasada = !concluida && prazo < today;
  const formatted = (() => {
    const [y, m, d] = prazo.split('-');
    if (!y) return prazo;
    return `${d}/${m}`;
  })();
  return (
    <span
      className={`flex items-center gap-1 text-[10.5px] ${
        atrasada ? 'text-red-400/80' : 'text-muted-foreground/70'
      }`}
    >
      {atrasada ? <AlertTriangle className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
      {formatted}
    </span>
  );
}

const todayStr = () => new Date().toISOString().split('T')[0];

const projetoStatusConfig = {
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

function projetoInitials(nome) {
  if (!nome) return '?';
  const words = nome.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return nome.slice(0, 2).toUpperCase();
}

function formatPrazoLong(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return null;
  }
}

function diasAteData(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diffMs = d.getTime() - hoje.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function TarefaForm({ onClose, onSave, onDelete, clienteId, projetoId, tarefa, squadMembros }) {
  const membros = squadMembros?.map((sm) => sm.profiles).filter(Boolean) ?? [];

  const [form, setForm] = useState({
    titulo: tarefa?.titulo ?? '',
    descricao: tarefa?.descricao ?? '',
    status: tarefa?.status ?? 'pendente',
    prioridade: tarefa?.prioridade ?? 'media',
    prazo: tarefa?.prazo ?? todayStr(),
    responsavel_id: tarefa?.responsavel_id ?? '',
    cliente_id: clienteId,
    projeto_id: tarefa?.projeto_id ?? projetoId,
  });

  const { data: projetosCliente = [] } = useQuery({
    queryKey: queryKeys.projetos.byCliente(clienteId),
    queryFn: () => projetosApi.byCliente(clienteId),
    enabled: !!clienteId,
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
          <h3 className="text-base font-semibold text-white">{tarefa ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
          <div className="flex items-center gap-1">
            {tarefa && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Excluir esta tarefa? Esta ação não pode ser desfeita.')) {
                    onDelete(tarefa.id);
                  }
                }}
                className="flex items-center gap-1.5 p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs"
                aria-label="Excluir tarefa"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-white p-1.5"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="space-y-3">
          <Input
            placeholder="Título da tarefa *"
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
          />
          <Input
            placeholder="Descrição (opcional)"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={form.prazo}
              onChange={(e) => setForm({ ...form, prazo: e.target.value })}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          {tarefa && (
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="revisao">Revisão</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          )}
          {projetosCliente.length > 1 && (
            <div className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select
                value={form.projeto_id || projetoId}
                onValueChange={(v) => setForm({ ...form, projeto_id: v })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Projeto" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  {projetosCliente.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Select
            value={form.responsavel_id || 'none'}
            onValueChange={(v) => setForm({ ...form, responsavel_id: v === 'none' ? '' : v })}
            disabled={membros.length === 0}
          >
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder={membros.length === 0 ? 'Sem membros no squad' : 'Responsável (opcional)'} />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-white/10">
              <SelectItem value="none">Sem responsável</SelectItem>
              {membros.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-3 pt-1">
            <Button type="button" onClick={onClose} variant="outline" className="flex-1 border-white/10 text-muted-foreground">Cancelar</Button>
            <Button
              type="button"
              disabled={!form.titulo.trim()}
              onClick={() => {
                const titulo = form.titulo.trim();
                if (!titulo) return;
                const { responsavel: _r, clientes: _c, ...rest } = form;
                onSave({ ...rest, titulo, prazo: form.prazo || todayStr() });
              }}
              className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 mr-1" /> {tarefa ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function TarefaCard({ tarefa, index, onOpen }) {
  const cfg = prioridadeConfig[tarefa.prioridade] || prioridadeConfig.media;
  const responsavelNome = tarefa.responsavel?.full_name || tarefa.responsavel?.email;

  return (
    <Draggable draggableId={tarefa.id} index={index}>
      {(provided, snapshot) => {
        const child = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => onOpen(tarefa)}
            className={`group glass-card border border-white/5 rounded-xl p-3 mb-2 cursor-grab active:cursor-grabbing transition-colors duration-200 select-none
              ${snapshot.isDragging ? 'border-white/20 shadow-lg shadow-black/20' : 'hover:border-white/10'}`}
          >
            <p className="text-sm text-white/95 font-medium leading-snug line-clamp-2 mb-2.5">
              {tarefa.titulo}
            </p>

            {tarefa.descricao && (
              <p className="text-xs text-muted-foreground/60 mb-2.5 line-clamp-2">{tarefa.descricao}</p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
              <span className={`flex items-center gap-1.5 text-[10.5px] font-medium ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
              <div className="flex items-center gap-2">
                <PrazoBadge prazo={tarefa.prazo} status={tarefa.status} />
                {responsavelNome && <Avatar name={responsavelNome} size={20} muted />}
              </div>
            </div>
          </div>
        );
        return snapshot.isDragging ? createPortal(child, document.body) : child;
      }}
    </Draggable>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 p-4 space-y-1.5">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em] flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </p>
      <p className={`text-xl font-bold tracking-tight ${accent || 'text-white'}`}>{value}</p>
    </div>
  );
}

export default function ProjetoKanban({ projeto, onBack }) {
  const [showForm, setShowForm] = useState(false);
  const [editandoTarefa, setEditandoTarefa] = useState(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: cliente } = useQuery({
    queryKey: queryKeys.clientes.detail(projeto.cliente_id),
    queryFn: () => clientesApi.get(projeto.cliente_id),
    enabled: !!projeto.cliente_id,
  });

  const squadMembros = cliente?.squads?.squad_membros ?? [];

  const { data: tarefas = [] } = useQuery({
    queryKey: queryKeys.tarefas.byProjeto(projeto.id),
    queryFn: () => tarefasApi.byProjeto(projeto.id),
    enabled: !!projeto.id,
  });

  const criar = useMutation({
    mutationFn: tarefasApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.byProjeto(projeto.id) });
      setShowForm(false);
      toast({ title: 'Tarefa criada!' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível criar a tarefa',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  const atualizar = useMutation({
    mutationFn: ({ id, data }) => tarefasApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.all });
      setEditandoTarefa(null);
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível atualizar a tarefa',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  const deletar = useMutation({
    mutationFn: tarefasApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.byProjeto(projeto.id) });
      toast({ title: 'Tarefa removida.' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível remover a tarefa',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    atualizar.mutate({ id: draggableId, data: { status: destination.droppableId } });
  };

  const cfg = projetoStatusConfig[projeto.status] || projetoStatusConfig.ativo;
  const concluidas = tarefas.filter((t) => t.status === 'concluida').length;
  const total = tarefas.length;
  const progresso = total > 0 ? Math.round((concluidas / total) * 100) : (projeto.status === 'concluido' ? 100 : 0);

  const prazoFormatado = formatPrazoLong(projeto.prazo);
  const diasRestantes = diasAteData(projeto.prazo);
  let prazoFooter = null;
  let prazoAccent = 'text-white';
  if (projeto.status === 'concluido') {
    prazoFooter = 'Projeto concluído';
    prazoAccent = 'text-emerald-300';
  } else if (diasRestantes != null) {
    if (diasRestantes < 0) {
      prazoFooter = `${Math.abs(diasRestantes)} dia${Math.abs(diasRestantes) === 1 ? '' : 's'} em atraso`;
      prazoAccent = 'text-red-400';
    } else if (diasRestantes === 0) {
      prazoFooter = 'Entrega hoje';
      prazoAccent = 'text-amber-300';
    } else {
      prazoFooter = `Em ${diasRestantes} dia${diasRestantes === 1 ? '' : 's'}`;
      prazoAccent = diasRestantes <= 7 ? 'text-amber-300' : 'text-white';
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-10 px-4 text-sm gap-2"
        >
          <Plus className="w-4 h-4" /> Nova Tarefa
        </Button>
      </div>

      <div className="space-y-5">
        <div className="flex items-start gap-5">
          <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center text-xl font-bold shrink-0 ${cfg.avatarBg}`}>
            {projetoInitials(projeto.nome)}
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-bold text-white truncate">{projeto.nome}</h2>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.pill}`}>
                {cfg.label}
              </span>
            </div>
            {projeto.descricao && (
              <p className="text-sm text-muted-foreground leading-relaxed">{projeto.descricao}</p>
            )}
            {cliente?.nome && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="w-4 h-4" />
                <span>Cliente</span>
                <span className="text-white font-medium">{cliente.nome}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-1 rounded-2xl border border-white/5 bg-white/[0.02]">
          <StatCard
            icon={CalendarDays}
            label="Prazo de Entrega"
            value={prazoFormatado || '—'}
            accent={prazoAccent}
          />
          <StatCard
            icon={Calendar}
            label="Status do Prazo"
            value={prazoFooter || '—'}
            accent={prazoAccent}
          />
          <StatCard
            icon={ListChecks}
            label="Tarefas"
            value={`${concluidas} / ${total}`}
          />
          <div className="glass-card rounded-2xl border border-white/5 p-4 space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
              Progresso
            </p>
            <p className="text-xl font-bold text-white tracking-tight">{progresso}%</p>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div className={`h-full rounded-full transition-all ${cfg.bar}`} style={{ width: `${progresso}%` }} />
            </div>
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((col) => {
            const colTarefas = tarefas.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className={`glass-card rounded-2xl border ${col.border} p-4`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.accent}`} />
                    <span className={`text-xs font-semibold ${col.color}`}>{col.label}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${col.accent} ${col.color}`}>
                    {colTarefas.length}
                  </span>
                </div>
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[100px] rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                    >
                      {colTarefas.map((t, i) => (
                        <TarefaCard
                          key={t.id}
                          tarefa={t}
                          index={i}
                          onOpen={setEditandoTarefa}
                        />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {showForm && (
        <TarefaForm
          onClose={() => setShowForm(false)}
          onSave={(f) => criar.mutate(f)}
          clienteId={projeto.cliente_id}
          projetoId={projeto.id}
          squadMembros={squadMembros}
        />
      )}

      {editandoTarefa && (
        <TarefaForm
          tarefa={editandoTarefa}
          onClose={() => setEditandoTarefa(null)}
          onSave={(f) => atualizar.mutate({ id: editandoTarefa.id, data: f })}
          onDelete={(id) => {
            deletar.mutate(id);
            setEditandoTarefa(null);
          }}
          clienteId={projeto.cliente_id}
          projetoId={projeto.id}
          squadMembros={squadMembros}
        />
      )}
    </div>
  );
}
