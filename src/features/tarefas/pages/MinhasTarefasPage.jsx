import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion } from 'framer-motion';
import {
  Plus,
  X,
  Check,
  Calendar,
  Flag,
  User,
  Grip,
  Loader2,
  Building2,
  AlignLeft,
  Sparkles,
  Trash2,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import { tarefasApi } from '@/features/tarefas/api/tarefas.api';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { queryKeys } from '@/entities/query-keys';

const columns = [
  { id: 'pendente', label: 'Pendente', color: 'text-slate-400', border: 'border-slate-500/30', accent: 'bg-slate-500/10' },
  { id: 'em_andamento', label: 'Em Andamento', color: 'text-blue-400', border: 'border-blue-500/30', accent: 'bg-blue-500/10' },
  { id: 'revisao', label: 'Revisão', color: 'text-yellow-400', border: 'border-yellow-500/30', accent: 'bg-yellow-500/10' },
  { id: 'concluida', label: 'Concluída', color: 'text-emerald-400', border: 'border-emerald-500/30', accent: 'bg-emerald-500/10' },
];

const prioridadeOptions = [
  { value: 'baixa', label: 'Baixa', color: 'text-slate-400', dot: 'bg-slate-400' },
  { value: 'media', label: 'Média', color: 'text-blue-400', dot: 'bg-blue-400' },
  { value: 'alta', label: 'Alta', color: 'text-amber-400', dot: 'bg-amber-400' },
  { value: 'urgente', label: 'Urgente', color: 'text-red-400', dot: 'bg-red-400' },
];

const prioridadeConfig = prioridadeOptions.reduce((acc, p) => {
  acc[p.value] = p;
  return acc;
}, {});

const TITULO_MAX = 120;
const DESCRICAO_MAX = 500;

function FieldLabel({ icon: Icon, children, required }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
      {required && <span className="text-[#EA3935]">*</span>}
    </label>
  );
}

function TarefaForm({ onClose, onSave, onDelete, clientes, responsavelId, isSubmitting, tarefa }) {
  const isEdit = !!tarefa;
  const [form, setForm] = useState({
    titulo: tarefa?.titulo ?? '',
    descricao: tarefa?.descricao ?? '',
    status: tarefa?.status ?? 'pendente',
    prioridade: tarefa?.prioridade ?? 'media',
    prazo: tarefa?.prazo ?? '',
    cliente_id: tarefa?.cliente_id ?? '',
    responsavel_id: tarefa?.responsavel_id ?? responsavelId ?? '',
  });
  const [submitted, setSubmitted] = useState(false);
  const tituloRef = useRef(null);

  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tituloTrim = form.titulo.trim();
  const tituloInvalid = submitted && !tituloTrim;
  const canSubmit = tituloTrim.length > 0 && !isSubmitting;

  const handleClienteChange = (id) => {
    setForm((f) => ({ ...f, cliente_id: id === 'none' ? '' : id }));
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setSubmitted(true);
    if (!canSubmit) return;
    onSave({ ...form, titulo: tituloTrim });
  };

  const prioridade = prioridadeConfig[form.prioridade] ?? prioridadeConfig.media;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative glass-card border border-white/10 rounded-2xl w-full max-w-lg z-10 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EA3935]/10 flex items-center justify-center">
              {isEdit ? <ListChecks className="w-4 h-4 text-[#EA3935]" /> : <Sparkles className="w-4 h-4 text-[#EA3935]" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-tight">
                {isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {isEdit ? 'Atualize os detalhes desta tarefa' : 'Organize sua próxima ação em segundos'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <FieldLabel required>Título</FieldLabel>
            <Input
              ref={tituloRef}
              placeholder="Ex.: Preparar proposta para o cliente"
              value={form.titulo}
              maxLength={TITULO_MAX}
              onChange={(e) => setForm({ ...form, titulo: e.target.value })}
              aria-invalid={tituloInvalid}
              className={`bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10 transition-colors ${
                tituloInvalid ? 'border-red-500/60 focus-visible:ring-red-500/30' : ''
              }`}
            />
            {tituloInvalid && (
              <p className="text-[11px] text-red-400 mt-1">Dê um nome para a tarefa.</p>
            )}
          </div>

          <div>
            <FieldLabel icon={AlignLeft}>Descrição</FieldLabel>
            <Textarea
              placeholder="Notas, contexto, links..."
              value={form.descricao}
              maxLength={DESCRICAO_MAX}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 min-h-[80px] resize-none"
            />
            <p className="text-[10px] text-muted-foreground/70 text-right mt-1">
              {form.descricao.length}/{DESCRICAO_MAX}
            </p>
          </div>

          {isEdit && (
            <div>
              <FieldLabel icon={ListChecks}>Status</FieldLabel>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  {columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${c.accent}`} />
                        <span className={c.color}>{c.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel icon={Flag}>Prioridade</FieldLabel>
              <Select
                value={form.prioridade}
                onValueChange={(v) => setForm({ ...form, prioridade: v })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${prioridade.dot}`} />
                      <span className={prioridade.color}>{prioridade.label}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  {prioridadeOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                        <span className={p.color}>{p.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel icon={Calendar}>Prazo</FieldLabel>
              <Input
                type="date"
                value={form.prazo}
                onChange={(e) => setForm({ ...form, prazo: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-10 [color-scheme:dark]"
              />
            </div>
          </div>

          {clientes.length > 0 && (
            <div>
              <FieldLabel icon={Building2}>Cliente (opcional)</FieldLabel>
              <Select value={form.cliente_id || 'none'} onValueChange={handleClienteChange}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                  <SelectValue placeholder="Vincular a um cliente" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  <SelectItem value="none">Sem cliente</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 pb-5 pt-1">
          {isEdit && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Excluir esta tarefa? Esta ação não pode ser desfeita.')) {
                  onDelete(tarefa.id);
                }
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors px-2 h-10"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          )}
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="flex-1 border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-white h-10"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> {isEdit ? 'Salvando...' : 'Criando...'}
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-1.5" /> {isEdit ? 'Salvar alterações' : 'Criar tarefa'}
              </>
            )}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}

function TarefaCard({ tarefa, index, onOpen }) {
  const cfg = prioridadeConfig[tarefa.prioridade] || prioridadeConfig.media;
  return (
    <Draggable draggableId={tarefa.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          onClick={() => onOpen(tarefa)}
          className={`glass-card border border-white/5 rounded-xl p-3.5 mb-2.5 cursor-pointer transition-all duration-200
            ${snapshot.isDragging ? 'border-purple-500/40 shadow-lg shadow-purple-500/10 rotate-1' : 'hover:border-white/10'}`}
        >
          <div className="flex items-start gap-2 mb-2">
            <div
              {...provided.dragHandleProps}
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-white mt-0.5 shrink-0 cursor-grab"
            >
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
            {tarefa.clientes?.nome && (
              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md" style={{ color: '#EA3935', background: 'rgba(234, 57, 53,0.12)' }}>
                <User className="w-3 h-3" />{tarefa.clientes.nome}
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}

export default function MinhasTarefasPage() {
  const [showForm, setShowForm] = useState(false);
  const [editandoTarefa, setEditandoTarefa] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: tarefas = [] } = useQuery({
    queryKey: queryKeys.tarefas.all,
    queryFn: tarefasApi.list,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: queryKeys.clientes.all,
    queryFn: clientesApi.list,
  });

  const criar = useMutation({
    mutationFn: tarefasApi.create,
    onSuccess: () => {
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
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.all });
      if (editandoTarefa && variables?.id === editandoTarefa.id) {
        setEditandoTarefa(null);
        toast({ title: 'Tarefa atualizada.' });
      }
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
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.all });
      setEditandoTarefa(null);
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

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Kanban de Tarefas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Arraste para mover entre colunas</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Nova Tarefa
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
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${col.accent} ${col.color}`}>{colTarefas.length}</span>
                </div>
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[120px] rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                    >
                      {colTarefas.map((t, i) => (
                        <TarefaCard key={t.id} tarefa={t} index={i} onOpen={setEditandoTarefa} />
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
          clientes={clientes}
          responsavelId={user?.id}
          isSubmitting={criar.isPending}
        />
      )}

      {editandoTarefa && (
        <TarefaForm
          tarefa={editandoTarefa}
          onClose={() => setEditandoTarefa(null)}
          onSave={(f) => atualizar.mutate({ id: editandoTarefa.id, data: f })}
          onDelete={(id) => deletar.mutate(id)}
          clientes={clientes}
          responsavelId={user?.id}
          isSubmitting={atualizar.isPending}
        />
      )}
    </div>
  );
}
