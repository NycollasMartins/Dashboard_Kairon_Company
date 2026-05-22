import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  X,
  Check,
  Calendar,
  Flag,
  Loader2,
  Building2,
  AlignLeft,
  Sparkles,
  Trash2,
  ListChecks,
  FolderKanban,
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  Users,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';
import { tarefasApi } from '@/features/tarefas/api/tarefas.api';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { projetosApi } from '@/features/projetos/api/projetos.api';
import { squadsApi } from '@/features/squads/api/squads.api';
import { usersApi } from '@/features/administrativo/api/users.api';
import { queryKeys } from '@/entities/query-keys';

const columns = [
  { id: 'pendente', label: 'Pendente', color: 'text-slate-300', dot: 'bg-slate-400', border: 'border-slate-500/20', accent: 'bg-slate-500/10' },
  { id: 'em_andamento', label: 'Em Andamento', color: 'text-blue-300', dot: 'bg-blue-400', border: 'border-blue-500/20', accent: 'bg-blue-500/10' },
  { id: 'revisao', label: 'Revisão', color: 'text-yellow-300', dot: 'bg-yellow-400', border: 'border-yellow-500/20', accent: 'bg-yellow-500/10' },
  { id: 'concluida', label: 'Concluída', color: 'text-emerald-300', dot: 'bg-emerald-400', border: 'border-emerald-500/20', accent: 'bg-emerald-500/10' },
];

const prioridadeOptions = [
  { value: 'baixa', label: 'Baixa', color: 'text-slate-300', dot: 'bg-slate-400', rank: 0 },
  { value: 'media', label: 'Média', color: 'text-blue-300', dot: 'bg-blue-400', rank: 1 },
  { value: 'alta', label: 'Alta', color: 'text-amber-300', dot: 'bg-amber-400', rank: 2 },
  { value: 'urgente', label: 'Urgente', color: 'text-red-300', dot: 'bg-red-400', rank: 3 },
];

const prioridadeConfig = prioridadeOptions.reduce((acc, p) => {
  acc[p.value] = p;
  return acc;
}, {});

const sortOptions = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'antigas', label: 'Mais antigas' },
  { value: 'prazo', label: 'Prazo (mais próximo)' },
  { value: 'prioridade', label: 'Prioridade (urgente → baixa)' },
  { value: 'titulo', label: 'Título (A → Z)' },
];

const TITULO_MAX = 120;
const DESCRICAO_MAX = 500;

const FILTERS_STORAGE_PREFIX = 'minhas-tarefas:filtros:v1';
const filtersStorageKey = (userId) => `${FILTERS_STORAGE_PREFIX}:${userId ?? 'anon'}`;

const loadStoredFilters = (userId) => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(filtersStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const todayStr = () => new Date().toISOString().split('T')[0];

const tagColorFor = (key) => {
  const palette = [
    { bg: 'rgba(234,57,53,0.12)', fg: '#EA3935' },
    { bg: 'rgba(59,130,246,0.14)', fg: '#60A5FA' },
    { bg: 'rgba(16,185,129,0.14)', fg: '#34D399' },
    { bg: 'rgba(168,85,247,0.14)', fg: '#C084FC' },
    { bg: 'rgba(245,158,11,0.14)', fg: '#FBBF24' },
    { bg: 'rgba(236,72,153,0.14)', fg: '#F472B6' },
  ];
  if (!key) return palette[0];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, size = 24, muted = false }) {
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

function FieldLabel({ icon: Icon, children, required }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
      {required && <span className="text-[#EA3935]">*</span>}
    </label>
  );
}

function TarefaForm({ onClose, onSave, onDelete = null, clientes, responsaveis = [], responsavelId, isSubmitting, tarefa = null }) {
  const isEdit = !!tarefa;
  const { user } = useAuth();
  const podeUsarOnboarding = user?.role === 'admin' || user?.role === 'head';
  const projetoEscolhidoManualmenteRef = useRef(isEdit);
  const [form, setForm] = useState({
    titulo: tarefa?.titulo ?? '',
    descricao: tarefa?.descricao ?? '',
    status: tarefa?.status ?? 'pendente',
    prioridade: tarefa?.prioridade ?? 'media',
    prazo: tarefa?.prazo ?? todayStr(),
    cliente_id: tarefa?.cliente_id ?? '',
    projeto_id: tarefa?.projeto_id ?? '',
    responsavel_id: tarefa?.responsavel_id ?? responsavelId ?? '',
  });

  const { data: projetosCliente = [] } = useQuery({
    queryKey: queryKeys.projetos.byCliente(form.cliente_id),
    queryFn: () => projetosApi.byCliente(form.cliente_id),
    enabled: !!form.cliente_id,
  });

  const projetosSelecionaveis = useMemo(() => {
    if (podeUsarOnboarding) return projetosCliente;
    return projetosCliente.filter(
      (p) => p.nome?.trim().toLowerCase() !== 'onboarding' || p.id === form.projeto_id
    );
  }, [projetosCliente, podeUsarOnboarding, form.projeto_id]);
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

  useEffect(() => {
    if (!form.cliente_id || form.projeto_id || projetoEscolhidoManualmenteRef.current) return;

    const backlog = projetosCliente.find(
      (projeto) => projeto.nome?.trim().toLowerCase() === 'backlog'
    );
    if (!backlog) return;

    setForm((f) => (
      f.projeto_id || f.cliente_id !== form.cliente_id
        ? f
        : { ...f, projeto_id: backlog.id }
    ));
  }, [form.cliente_id, form.projeto_id, projetosCliente]);

  const tituloTrim = form.titulo.trim();
  const tituloInvalid = submitted && !tituloTrim;
  const canSubmit = tituloTrim.length > 0 && !isSubmitting;

  const handleClienteChange = (id) => {
    projetoEscolhidoManualmenteRef.current = false;
    setForm((f) => ({
      ...f,
      cliente_id: id === 'none' ? '' : id,
      projeto_id: '',
    }));
  };

  const handleProjetoChange = (id) => {
    projetoEscolhidoManualmenteRef.current = true;
    if (!isEdit && id === 'none') return;
    setForm((f) => ({ ...f, projeto_id: id === 'none' ? '' : id }));
  };

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setSubmitted(true);
    if (!canSubmit) return;
    onSave({ ...form, titulo: tituloTrim, prazo: form.prazo || todayStr() });
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
              {isEdit ? (
                <p className="mt-1.5 text-[11px] text-muted-foreground/70 italic">
                  {tarefa?.criador?.full_name || tarefa?.criador?.email
                    ? `Criada por ${tarefa.criador.full_name || tarefa.criador.email}`
                    : 'Criador desconhecido'}
                  {tarefa?.created_at && (
                    <> · {new Date(tarefa.created_at).toLocaleDateString('pt-BR')}</>
                  )}
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Organize sua próxima ação em segundos
                </p>
              )}
            </div>
          </div>
          {isEdit && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Excluir esta tarefa? Esta ação não pode ser desfeita.')) {
                  onDelete(tarefa.id);
                }
              }}
              className="flex items-center gap-1.5 p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs shrink-0"
              aria-label="Excluir tarefa"
            >
              <Trash2 className="w-4 h-4" />
              Excluir
            </button>
          )}
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
                        <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                        <span className={c.color}>{c.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(() => {
            const responsavelAtualForaDoSquad =
              form.responsavel_id &&
              !responsaveis.some((r) => r.id === form.responsavel_id)
                ? tarefa?.responsavel
                : null;
            const opcoes = responsavelAtualForaDoSquad
              ? [
                  {
                    id: form.responsavel_id,
                    full_name:
                      responsavelAtualForaDoSquad.full_name ||
                      responsavelAtualForaDoSquad.email ||
                      'Responsável atual',
                  },
                  ...responsaveis,
                ]
              : responsaveis;
            if (opcoes.length === 0) return null;
            return (
              <div>
                <FieldLabel icon={Users}>Responsável</FieldLabel>
                <Select
                  value={form.responsavel_id || 'none'}
                  onValueChange={(v) =>
                    setForm({ ...form, responsavel_id: v === 'none' ? '' : v })
                  }
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/10">
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {opcoes.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        <span className="flex items-center gap-2">
                          <Avatar name={u.full_name} size={18} />
                          <span className="truncate">{u.full_name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })()}

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

          {(() => {
            const clienteAtualChurn = clientes.find(
              (c) => c.id === form.cliente_id && c.status === 'churn'
            );
            const clientesSelecionaveis = clientes.filter(
              (c) => c.status !== 'churn' || c.id === clienteAtualChurn?.id
            );
            if (clientesSelecionaveis.length === 0) return null;
            return (
              <div>
                <FieldLabel icon={Building2}>Cliente (opcional)</FieldLabel>
                <Select value={form.cliente_id || 'none'} onValueChange={handleClienteChange}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                    <SelectValue placeholder="Vincular a um cliente" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1a1a2e] border-white/10">
                    <SelectItem value="none">Sem cliente</SelectItem>
                    {clientesSelecionaveis.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                        {c.status === 'churn' ? ' (churn)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })()}

          {form.cliente_id && (
            <div>
              <FieldLabel icon={FolderKanban}>{isEdit ? 'Projeto (opcional)' : 'Projeto'}</FieldLabel>
              <Select
                value={isEdit ? (form.projeto_id || 'none') : (form.projeto_id || undefined)}
                onValueChange={handleProjetoChange}
                disabled={projetosSelecionaveis.length === 0}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                  <SelectValue
                    placeholder={
                      projetosSelecionaveis.length === 0
                        ? 'Este cliente ainda não tem projetos'
                        : 'Vincular a um projeto'
                    }
                  />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  {isEdit && <SelectItem value="none">Sem projeto</SelectItem>}
                  {projetosSelecionaveis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 pb-5 pt-1">
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

function TarefaCard({ tarefa, index, onOpen }) {
  const cfg = prioridadeConfig[tarefa.prioridade] || prioridadeConfig.media;
  const clienteNome = tarefa.clientes?.nome;
  const responsavelNome = tarefa.responsavel?.full_name || tarefa.responsavel?.email;
  const projetoNome = tarefa.projetos?.nome;

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
            {(clienteNome || projetoNome) && (
              <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-muted-foreground/70">
                {clienteNome && <span className="truncate">{clienteNome}</span>}
                {clienteNome && projetoNome && <span className="opacity-40">·</span>}
                {projetoNome && <span className="truncate">{projetoNome}</span>}
              </div>
            )}

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

function MultiSelectPopover({ icon: Icon, label, items, selected, onChange, getKey, getLabel, renderItem }) {
  const [open, setOpen] = useState(false);
  const count = selected.size;
  const toggle = (key) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1.5 text-xs px-2.5 h-8 rounded-lg border transition-colors ${
            count > 0
              ? 'border-[#EA3935]/40 bg-[#EA3935]/10 text-white'
              : 'border-white/10 bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10'
          }`}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          <span className="font-medium">{label}</span>
          {count > 0 && (
            <span className="text-[10px] font-bold px-1 rounded bg-white/15 text-white">{count}</span>
          )}
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 bg-[#1a1a2e] border-white/10 text-white p-2"
      >
        <div className="flex items-center justify-between px-2 pt-1 pb-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
          {count > 0 && (
            <button
              type="button"
              onClick={() => onChange(new Set())}
              className="text-[11px] text-muted-foreground hover:text-white transition-colors"
            >
              Limpar
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-2 py-3">Nada disponível.</p>
          ) : (
            items.map((it) => {
              const key = getKey(it);
              const isSelected = selected.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle(key)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                    isSelected ? 'bg-white/10 text-white' : 'text-muted-foreground hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    className="border-white/20 data-[state=checked]:bg-[#EA3935] data-[state=checked]:border-[#EA3935] pointer-events-none"
                  />
                  <span className="flex-1 text-left truncate">
                    {renderItem ? renderItem(it) : getLabel(it)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function compareByPrazo(a, b) {
  if (!a.prazo && !b.prazo) return 0;
  if (!a.prazo) return 1;
  if (!b.prazo) return -1;
  return a.prazo.localeCompare(b.prazo);
}

function applySort(list, sort) {
  const arr = [...list];
  switch (sort) {
    case 'antigas':
      return arr.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    case 'prazo':
      return arr.sort(compareByPrazo);
    case 'prioridade':
      return arr.sort((a, b) => {
        const ra = prioridadeConfig[a.prioridade]?.rank ?? -1;
        const rb = prioridadeConfig[b.prioridade]?.rank ?? -1;
        return rb - ra;
      });
    case 'titulo':
      return arr.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || '', 'pt-BR'));
    case 'recentes':
    default:
      return arr.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }
}

const OPERACIONAL_ROLES = ['admin', 'social media'];

export default function MinhasTarefasPage() {
  const { user } = useAuth();
  if (!OPERACIONAL_ROLES.includes(user?.role)) {
    return (
      <RestrictedAccessCard
        description="Apenas usuários com perfil admin ou social media podem acessar Tarefas."
      />
    );
  }
  return <MinhasTarefasPageContent />;
}

function MinhasTarefasPageContent() {
  const [showForm, setShowForm] = useState(false);
  const [editandoTarefa, setEditandoTarefa] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [busca, setBusca] = useState('');
  const [sort, setSort] = useState('recentes');
  const [filtroResponsaveis, setFiltroResponsaveis] = useState(() => new Set());
  const [filtroClientes, setFiltroClientes] = useState(() => new Set());
  const [filtroProjetos, setFiltroProjetos] = useState(() => new Set());
  const [filtroPrioridades, setFiltroPrioridades] = useState(() => new Set());
  const [filtrosHidratados, setFiltrosHidratados] = useState(false);

  const initRespFilterRef = useRef(false);
  useEffect(() => {
    if (initRespFilterRef.current || !user?.id) return;
    initRespFilterRef.current = true;

    const stored = loadStoredFilters(user.id);
    if (stored) {
      if (typeof stored.busca === 'string') setBusca(stored.busca);
      if (typeof stored.sort === 'string') setSort(stored.sort);
      if (Array.isArray(stored.filtroResponsaveis)) setFiltroResponsaveis(new Set(stored.filtroResponsaveis));
      else setFiltroResponsaveis(new Set([user.id]));
      if (Array.isArray(stored.filtroClientes)) setFiltroClientes(new Set(stored.filtroClientes));
      if (Array.isArray(stored.filtroProjetos)) setFiltroProjetos(new Set(stored.filtroProjetos));
      if (Array.isArray(stored.filtroPrioridades)) setFiltroPrioridades(new Set(stored.filtroPrioridades));
    } else {
      setFiltroResponsaveis(new Set([user.id]));
    }
    setFiltrosHidratados(true);
  }, [user?.id]);

  useEffect(() => {
    if (!filtrosHidratados || !user?.id || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        filtersStorageKey(user.id),
        JSON.stringify({
          busca,
          sort,
          filtroResponsaveis: Array.from(filtroResponsaveis),
          filtroClientes: Array.from(filtroClientes),
          filtroProjetos: Array.from(filtroProjetos),
          filtroPrioridades: Array.from(filtroPrioridades),
        })
      );
    } catch {
      // storage indisponível — ignora
    }
  }, [
    filtrosHidratados,
    user?.id,
    busca,
    sort,
    filtroResponsaveis,
    filtroClientes,
    filtroProjetos,
    filtroPrioridades,
  ]);

  const { data: tarefas = [] } = useQuery({
    queryKey: queryKeys.tarefas.all,
    queryFn: tarefasApi.list,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: queryKeys.clientes.all,
    queryFn: clientesApi.list,
  });

  const { data: projetos = [] } = useQuery({
    queryKey: queryKeys.projetos.all,
    queryFn: projetosApi.list,
  });

  const { data: squads = [] } = useQuery({
    queryKey: queryKeys.squads.all,
    queryFn: squadsApi.list,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: usersApi.list,
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

  const meusSquads = useMemo(
    () => squads.filter((s) => s.squad_membros?.some((sm) => sm.profile_id === user?.id)),
    [squads, user?.id]
  );

  const meusSquadsNome = meusSquads.map((s) => s.nome).join(' · ');

  const squadMemberIds = useMemo(() => {
    const ids = new Set();
    meusSquads.forEach((s) => {
      s.squad_membros?.forEach((sm) => {
        if (sm.profile_id) ids.add(sm.profile_id);
      });
    });
    if (user?.id) ids.add(user.id);
    return ids;
  }, [meusSquads, user?.id]);

  const tarefasDoSquad = useMemo(() => {
    const baseClientesAtivos = tarefas.filter((t) => t.clientes?.status !== 'churn');
    if (squadMemberIds.size === 0) return baseClientesAtivos;
    return baseClientesAtivos.filter(
      (t) => !t.responsavel_id || squadMemberIds.has(t.responsavel_id)
    );
  }, [tarefas, squadMemberIds]);

  const responsaveisDoSquad = useMemo(() => {
    const map = new Map();
    tarefasDoSquad.forEach((t) => {
      const r = t.responsavel;
      const id = r?.id || t.responsavel_id;
      if (!id) return;
      if (!map.has(id)) {
        map.set(id, { id, full_name: r?.full_name || r?.email || 'Sem nome', email: r?.email });
      }
    });
    usuarios.forEach((u) => {
      if (squadMemberIds.has(u.id) && !map.has(u.id)) {
        map.set(u.id, { id: u.id, full_name: u.full_name || u.email, email: u.email });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name, 'pt-BR'));
  }, [tarefasDoSquad, usuarios, squadMemberIds]);

  const clientesNoEscopo = useMemo(() => {
    const ids = new Set();
    tarefasDoSquad.forEach((t) => t.cliente_id && ids.add(t.cliente_id));
    return clientes.filter((c) => ids.has(c.id));
  }, [tarefasDoSquad, clientes]);

  const projetosNoEscopo = useMemo(() => {
    const ids = new Set();
    tarefasDoSquad.forEach((t) => t.projeto_id && ids.add(t.projeto_id));
    return projetos.filter((p) => ids.has(p.id));
  }, [tarefasDoSquad, projetos]);

  const tarefasFiltradas = useMemo(() => {
    const buscaLower = busca.trim().toLowerCase();
    return tarefasDoSquad.filter((t) => {
      if (filtroResponsaveis.size > 0 && !filtroResponsaveis.has(t.responsavel_id)) return false;
      if (filtroClientes.size > 0 && !filtroClientes.has(t.cliente_id)) return false;
      if (filtroProjetos.size > 0 && !filtroProjetos.has(t.projeto_id)) return false;
      if (filtroPrioridades.size > 0 && !filtroPrioridades.has(t.prioridade)) return false;
      if (buscaLower) {
        const haystack = `${t.titulo || ''} ${t.descricao || ''} ${t.clientes?.nome || ''} ${t.projetos?.nome || ''} ${t.responsavel?.full_name || ''}`.toLowerCase();
        if (!haystack.includes(buscaLower)) return false;
      }
      return true;
    });
  }, [
    tarefasDoSquad,
    filtroResponsaveis,
    filtroClientes,
    filtroProjetos,
    filtroPrioridades,
    busca,
  ]);

  const tarefasOrdenadas = useMemo(() => applySort(tarefasFiltradas, sort), [tarefasFiltradas, sort]);

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    atualizar.mutate({ id: draggableId, data: { status: destination.droppableId } });
  };

  const algumFiltroNaoPadrao =
    filtroResponsaveis.size > 0 ||
    filtroClientes.size > 0 ||
    filtroProjetos.size > 0 ||
    filtroPrioridades.size > 0 ||
    !!busca ||
    sort !== 'recentes';

  const limparFiltros = () => {
    setFiltroResponsaveis(new Set());
    setFiltroClientes(new Set());
    setFiltroProjetos(new Set());
    setFiltroPrioridades(new Set());
    setBusca('');
    setSort('recentes');
  };

  const totalEscopo = tarefasDoSquad.length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 mb-1">
            <Users className="w-3 h-3" />
            <span className="truncate">
              {meusSquadsNome || 'Sem squad atribuído'}
            </span>
            <span className="opacity-40">·</span>
            <span>Board</span>
          </div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Tarefas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tarefasOrdenadas.length} de {totalEscopo} tarefa{totalEscopo === 1 ? '' : 's'} visíveis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar tarefa..."
              className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-9 pl-7 pr-2 w-56 text-sm"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white h-9 w-auto gap-1.5 text-xs px-2.5">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1a1a2e] border-white/10">
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm h-9"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Nova Tarefa
          </Button>
        </div>
      </div>

      <div className="glass-card border border-white/5 rounded-2xl p-3 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground uppercase tracking-wide font-semibold pr-1">
            <SlidersHorizontal className="w-3 h-3" />
            Filtros
          </span>

          <MultiSelectPopover
            icon={Flag}
            label="Prioridade"
            items={prioridadeOptions}
            selected={filtroPrioridades}
            onChange={setFiltroPrioridades}
            getKey={(p) => p.value}
            getLabel={(p) => p.label}
            renderItem={(p) => (
              <span className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                <span className={p.color}>{p.label}</span>
              </span>
            )}
          />

          <MultiSelectPopover
            icon={Users}
            label="Responsável"
            items={responsaveisDoSquad}
            selected={filtroResponsaveis}
            onChange={setFiltroResponsaveis}
            getKey={(u) => u.id}
            getLabel={(u) => u.full_name}
            renderItem={(u) => (
              <span className="flex items-center gap-2">
                <Avatar name={u.full_name} size={18} />
                <span className="truncate">{u.full_name}</span>
              </span>
            )}
          />

          <MultiSelectPopover
            icon={Building2}
            label="Cliente"
            items={clientesNoEscopo}
            selected={filtroClientes}
            onChange={setFiltroClientes}
            getKey={(c) => c.id}
            getLabel={(c) => c.nome}
            renderItem={(c) => (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: tagColorFor(c.nome).fg }} />
                <span className="truncate">{c.nome}</span>
              </span>
            )}
          />

          <MultiSelectPopover
            icon={FolderKanban}
            label="Projeto"
            items={projetosNoEscopo}
            selected={filtroProjetos}
            onChange={setFiltroProjetos}
            getKey={(p) => p.id}
            getLabel={(p) => p.nome}
          />

          {algumFiltroNaoPadrao && (
            <button
              type="button"
              onClick={limparFiltros}
              className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-white transition-colors px-2 h-7 rounded-md hover:bg-white/5"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((col) => {
            const colTarefas = tarefasOrdenadas.filter((t) => t.status === col.id);
            return (
              <div key={col.id} className={`glass-card rounded-2xl border ${col.border} p-3.5 flex flex-col min-h-[200px]`}>
                <div className="flex items-center justify-between mb-3.5 px-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className={`text-xs font-semibold ${col.color}`}>{col.label}</span>
                    <span className="text-[11px] font-medium text-muted-foreground">{colTarefas.length}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="p-1 rounded-md text-muted-foreground/60 hover:text-white hover:bg-white/5 transition-colors"
                    aria-label="Adicionar tarefa"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                    >
                      {colTarefas.length === 0 ? (
                        <div className="h-full min-h-[80px] flex items-center justify-center text-[11px] text-muted-foreground/60 italic">
                          {col.id === 'concluida' ? 'Nada concluído ainda' : 'Vazio'}
                        </div>
                      ) : (
                        colTarefas.map((t, i) => (
                          <TarefaCard key={t.id} tarefa={t} index={i} onOpen={setEditandoTarefa} />
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <AnimatePresence>
        {tarefasOrdenadas.length === 0 && totalEscopo > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card border border-white/5 rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
              <Filter className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Nenhuma tarefa corresponde aos filtros</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ajuste os filtros para ver mais tarefas do seu squad.</p>
            </div>
            <Button
              onClick={limparFiltros}
              variant="outline"
              className="border-white/10 bg-transparent text-muted-foreground hover:text-white hover:bg-white/5 h-8 text-xs"
            >
              Limpar filtros
            </Button>
          </motion.div>
        )}

        {totalEscopo === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card border border-white/5 rounded-2xl p-10 flex flex-col items-center gap-3 text-center"
          >
            <div className="w-12 h-12 rounded-xl bg-[#EA3935]/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-[#EA3935]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">O squad ainda não tem tarefas</p>
              <p className="text-xs text-muted-foreground mt-0.5">Crie a primeira tarefa para começar a organizar o trabalho.</p>
            </div>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova tarefa
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {showForm && (
        <TarefaForm
          onClose={() => setShowForm(false)}
          onSave={(f) => criar.mutate(f)}
          clientes={clientes}
          responsaveis={responsaveisDoSquad}
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
          responsaveis={responsaveisDoSquad}
          responsavelId={user?.id}
          isSubmitting={atualizar.isPending}
        />
      )}
    </div>
  );
}
