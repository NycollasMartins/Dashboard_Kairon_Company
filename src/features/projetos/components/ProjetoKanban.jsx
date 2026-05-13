import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import { Plus, X, Check, Calendar, Flag, Grip, ArrowLeft, Trash2, Edit2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { tarefasApi } from '@/features/tarefas/api/tarefas.api';
import { queryKeys } from '@/entities/query-keys';

const columns = [
  { id: 'pendente', label: 'Pendente', color: 'text-slate-400', border: 'border-slate-500/30', accent: 'bg-slate-500/10' },
  { id: 'em_andamento', label: 'Em Andamento', color: 'text-blue-400', border: 'border-blue-500/30', accent: 'bg-blue-500/10' },
  { id: 'revisao', label: 'Revisão', color: 'text-yellow-400', border: 'border-yellow-500/30', accent: 'bg-yellow-500/10' },
  { id: 'concluida', label: 'Concluída', color: 'text-emerald-400', border: 'border-emerald-500/30', accent: 'bg-emerald-500/10' },
];

const prioridadeConfig = {
  baixa: { label: 'Baixa', color: 'text-slate-400' },
  media: { label: 'Média', color: 'text-blue-400' },
  alta: { label: 'Alta', color: 'text-red-400' },
  urgente: { label: 'Urgente', color: 'text-red-400' },
};

const projetoStatusConfig = {
  ativo: { label: 'Ativo', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  pausado: { label: 'Pausado', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  concluido: { label: 'Concluído', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
};

function TarefaForm({ onClose, onSave, clienteId, projetoId, tarefa, squadMembros }) {
  const membros = squadMembros?.map((sm) => sm.profiles).filter(Boolean) ?? [];

  const [form, setForm] = useState({
    titulo: tarefa?.titulo ?? '',
    descricao: tarefa?.descricao ?? '',
    status: tarefa?.status ?? 'pendente',
    prioridade: tarefa?.prioridade ?? 'media',
    prazo: tarefa?.prazo ?? '',
    responsavel_id: tarefa?.responsavel_id ?? '',
    cliente_id: clienteId,
    projeto_id: projetoId,
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
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
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
                onSave({ ...rest, titulo });
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

function TarefaCard({ tarefa, index, onEdit, onDelete }) {
  const cfg = prioridadeConfig[tarefa.prioridade] || prioridadeConfig.media;
  const responsavel = tarefa.responsavel;

  return (
    <Draggable draggableId={tarefa.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`glass-card border border-white/5 rounded-xl p-3.5 mb-2.5 transition-all duration-200 group
            ${snapshot.isDragging ? 'border-[#EA3935]/40 shadow-lg shadow-red-500/10 rotate-1' : 'hover:border-white/10'}`}
        >
          <div className="flex items-start gap-2 mb-2">
            <div {...provided.dragHandleProps} className="text-muted-foreground hover:text-white mt-0.5 shrink-0 cursor-grab">
              <Grip className="w-3.5 h-3.5" />
            </div>
            <p className="text-sm text-white font-medium flex-1 leading-snug">{tarefa.titulo}</p>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => onEdit(tarefa)}
                className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDelete(tarefa.id)}
                className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          {tarefa.descricao && <p className="text-xs text-muted-foreground mb-2 ml-5 line-clamp-2">{tarefa.descricao}</p>}
          <div className="flex items-center gap-2 flex-wrap ml-5">
            <span className={`flex items-center gap-1 text-xs ${cfg.color}`}>
              <Flag className="w-3 h-3" />{cfg.label}
            </span>
            {tarefa.prazo && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />{tarefa.prazo}
              </span>
            )}
            {responsavel && (
              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-white/5 text-muted-foreground">
                <User className="w-3 h-3 shrink-0" />
                {responsavel.full_name || responsavel.email}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default function ProjetoKanban({ projeto, clienteNome, squadMembros = [], onBack }) {
  const [showForm, setShowForm] = useState(false);
  const [editandoTarefa, setEditandoTarefa] = useState(null);
  const { toast } = useToast();
  const qc = useQueryClient();

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
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.byProjeto(projeto.id) });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{projeto.nome}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-lg border font-medium ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
          </div>
          {projeto.descricao && <p className="text-xs text-muted-foreground mt-0.5">{projeto.descricao}</p>}
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-xs h-8 px-3">
          <Plus className="w-3.5 h-3.5 mr-1" /> Nova Tarefa
        </Button>
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
                          onEdit={setEditandoTarefa}
                          onDelete={(id) => deletar.mutate(id)}
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
          clienteId={projeto.cliente_id}
          projetoId={projeto.id}
          squadMembros={squadMembros}
        />
      )}
    </div>
  );
}
