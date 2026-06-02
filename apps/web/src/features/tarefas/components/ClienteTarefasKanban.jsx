import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import { Plus, X, Check, Calendar, Flag, Grip, CheckSquare } from 'lucide-react';
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

function TarefaForm({ onClose, onSave, clienteId, clienteNome }) {
  const [form, setForm] = useState({
    titulo: '', descricao: '', status: 'pendente', prioridade: 'media', prazo: '',
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
          <h3 className="text-base font-semibold text-white">Nova Tarefa</h3>
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
          <div className="px-3 py-2 rounded-xl bg-[#EA3935]/10 border border-[#EA3935]/20 text-xs text-[#EA3935]">
            Vinculada a: <span className="font-semibold">{clienteNome}</span>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" onClick={onClose} variant="outline" className="flex-1 border-white/10 text-muted-foreground">Cancelar</Button>
            <Button
              type="button"
              disabled={!form.titulo.trim()}
              onClick={() => {
                const titulo = form.titulo.trim();
                if (!titulo) return;
                onSave({ ...form, titulo });
              }}
              className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 mr-1" /> Criar
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function TarefaCard({ tarefa, index }) {
  const cfg = prioridadeConfig[tarefa.prioridade] || prioridadeConfig.media;
  return (
    <Draggable draggableId={tarefa.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`glass-card border border-white/5 rounded-xl p-3.5 mb-2.5 cursor-grab transition-all duration-200
            ${snapshot.isDragging ? 'border-[#EA3935]/40 shadow-lg shadow-red-500/10 rotate-1' : 'hover:border-white/10'}`}
        >
          <div className="flex items-start gap-2 mb-2">
            <div {...provided.dragHandleProps} className="text-muted-foreground hover:text-white mt-0.5 shrink-0">
              <Grip className="w-3.5 h-3.5" />
            </div>
            <p className="text-sm text-white font-medium flex-1 leading-snug">{tarefa.titulo}</p>
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
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default function ClienteTarefasKanban({ clienteId, clienteNome }) {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: tarefas = [] } = useQuery({
    queryKey: queryKeys.tarefas.byCliente(clienteId),
    queryFn: () => tarefasApi.byCliente(clienteId),
    enabled: !!clienteId,
  });

  const criar = useMutation({
    mutationFn: tarefasApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.byCliente(clienteId) });
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.all });
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
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.byCliente(clienteId) });
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.all });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível atualizar a tarefa',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    atualizar.mutate({ id: draggableId, data: { status: destination.droppableId } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-[#EA3935]" />
          Tarefas do Cliente
          <span className="text-xs text-muted-foreground font-normal">({tarefas.length})</span>
        </p>
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
                      {colTarefas.map((t, i) => <TarefaCard key={t.id} tarefa={t} index={i} />)}
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
          clienteId={clienteId}
          clienteNome={clienteNome}
        />
      )}
    </div>
  );
}
