import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus, Trash2, Repeat, Users as UsersIcon, Wrench, Server, Landmark, Megaphone, Package, Receipt,
  X, Check, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import { formatBRL } from '@/features/clientes/utils/contrato.format';
import { custosApi } from '@/features/financeiro/api/financeiro.api';
import { custoOperacionalSeriesYear } from '@/features/financeiro/lib/financeiro.calc';
import { queryKeys } from '@/entities/query-keys';

export const CATEGORIAS = {
  salarios: { label: 'Salários', icon: UsersIcon, color: 'text-blue-300', bg: 'bg-blue-500/10' },
  ferramentas: { label: 'Ferramentas / SaaS', icon: Wrench, color: 'text-purple-300', bg: 'bg-purple-500/10' },
  infraestrutura: { label: 'Infraestrutura', icon: Server, color: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  impostos: { label: 'Impostos', icon: Landmark, color: 'text-amber-300', bg: 'bg-amber-500/10' },
  marketing: { label: 'Marketing', icon: Megaphone, color: 'text-[#EA3935]', bg: 'bg-[#EA3935]/10' },
  outros: { label: 'Outros', icon: Package, color: 'text-slate-300', bg: 'bg-slate-500/10' },
};

const CAT_KEYS = Object.keys(CATEGORIAS);
const pad = (n) => String(n).padStart(2, '0');

function competenciaLabel(iso) {
  const [y, m] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

// Modal de edição de um custo.
function CustoEditModal({ custo, onClose, onSave, isSaving }) {
  const [form, setForm] = useState({
    description: custo.description ?? '',
    category: custo.category ?? 'outros',
    amount: String(custo.amount ?? ''),
    mes: String(custo.competencia ?? '').slice(0, 7),
    recurring: !!custo.recurring,
    notes: custo.notes ?? '',
  });
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    const valor = Number(String(form.amount).replace(',', '.'));
    if (!form.description.trim() || !Number.isFinite(valor) || valor <= 0) return;
    onSave({
      description: form.description.trim(),
      category: form.category,
      amount: valor,
      competencia: `${form.mes}-01`,
      recurring: form.recurring,
      notes: form.notes?.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative glass-card border border-white/10 rounded-2xl w-full max-w-md z-10 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EA3935]/10 flex items-center justify-center">
              <Pencil className="w-4 h-4 text-[#EA3935]" />
            </div>
            <h3 className="text-sm font-semibold text-white">Editar custo</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <Input
            ref={ref}
            placeholder="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-10"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                {CAT_KEYS.map((k) => (<SelectItem key={k} value={k}>{CATEGORIAS[k].label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Input
              type="number" step="0.01" min="0" placeholder="Valor"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="bg-white/5 border-white/10 text-white h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 items-center">
            <Input
              type="month"
              value={form.mes}
              onChange={(e) => setForm({ ...form, mes: e.target.value })}
              className="bg-white/5 border-white/10 text-white h-10 [color-scheme:dark]"
            />
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer px-1">
              <input
                type="checkbox"
                checked={form.recurring}
                onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
                className="h-4 w-4 accent-[#EA3935]"
              />
              Custo mensal
            </label>
          </div>
          <Textarea
            placeholder="Notas (opcional)"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 min-h-[60px] resize-none"
          />
        </div>

        <div className="flex items-center gap-3 px-6 pb-5 pt-1">
          <Button type="button" onClick={onClose} variant="outline" className="flex-1 border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-white h-10">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSaving} className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-10 disabled:opacity-50">
            <Check className="w-4 h-4 mr-1.5" /> Salvar
          </Button>
        </div>
      </motion.form>
    </div>
  );
}

export default function CustosOperacionais({ year }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();
  const anoRef = year ?? now.getFullYear();
  const isCurrentYear = anoRef === now.getFullYear();

  const [form, setForm] = useState({
    description: '',
    category: 'ferramentas',
    amount: '',
    mes: `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
    recurring: false,
  });
  const [excluindo, setExcluindo] = useState(null);
  const [editando, setEditando] = useState(null);

  const { data: custos = [] } = useQuery({ queryKey: queryKeys.financeiro.custos, queryFn: custosApi.list });

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.financeiro.custos });

  const criar = useMutation({
    mutationFn: (payload) => custosApi.create(payload),
    onSuccess: () => {
      invalidate();
      setForm((f) => ({ ...f, description: '', amount: '' }));
      toast({ title: 'Custo registrado!' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Não foi possível registrar', description: err?.message }),
  });

  const excluir = useMutation({
    mutationFn: (id) => custosApi.remove(id),
    onSuccess: () => {
      invalidate();
      setExcluindo(null);
      toast({ title: 'Custo removido.' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Não foi possível remover', description: err?.message }),
  });

  const atualizar = useMutation({
    mutationFn: ({ id, data }) => custosApi.update(id, data),
    onSuccess: () => {
      invalidate();
      setEditando(null);
      toast({ title: 'Custo atualizado!' });
    },
    onError: (err) => toast({ variant: 'destructive', title: 'Não foi possível atualizar', description: err?.message }),
  });

  const totais = useMemo(() => {
    const serie = custoOperacionalSeriesYear(custos, anoRef);
    const ano = serie.reduce((a, b) => a + b, 0);
    // No ano atual mostra o mês corrente; em anos fechados mostra a média mensal.
    const destaque = isCurrentYear ? serie[now.getMonth()] : ano / 12;
    const recorrenteMensal = custos
      .filter((c) => c.recurring)
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return { destaque, ano, recorrenteMensal };
  }, [custos, anoRef, isCurrentYear, now]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const valor = Number(String(form.amount).replace(',', '.'));
    if (!form.description.trim() || !Number.isFinite(valor) || valor <= 0) {
      toast({ variant: 'destructive', title: 'Preencha descrição e valor válido.' });
      return;
    }
    criar.mutate({
      description: form.description.trim(),
      category: form.category,
      amount: valor,
      competencia: `${form.mes}-01`,
      recurring: form.recurring,
      created_by: user?.id ?? null,
    });
  };

  return (
    <div className="space-y-5">
      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl border border-white/5 p-6">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{isCurrentYear ? 'Custo operacional do mês' : 'Média mensal'}</p>
          <p className="text-3xl font-semibold text-white tracking-tight mt-2 tabular-nums">{formatBRL(totais.destaque)}</p>
        </div>
        <div className="glass-card rounded-2xl border border-white/5 p-6">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Custo no ano ({anoRef})</p>
          <p className="text-3xl font-semibold text-white tracking-tight mt-2 tabular-nums">{formatBRL(totais.ano)}</p>
        </div>
        <div className="glass-card rounded-2xl border border-white/5 p-6">
          <div className="flex items-center gap-1.5">
            <Repeat className="w-3 h-3 text-emerald-300" />
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Recorrente / mês</p>
          </div>
          <p className="text-3xl font-semibold text-white tracking-tight mt-2 tabular-nums">{formatBRL(totais.recorrenteMensal)}</p>
        </div>
      </div>

      {/* Formulário de novo custo */}
      <form onSubmit={handleSubmit} className="glass-card rounded-2xl border border-white/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="w-4 h-4 text-[#EA3935]" />
          <p className="text-sm font-semibold text-white">Registrar custo</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4">
            <Input
              placeholder="Descrição (ex.: Adobe, Salário João...)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10"
            />
          </div>
          <div className="sm:col-span-3">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                {CAT_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>{CATEGORIAS[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Input
              type="number" step="0.01" min="0" placeholder="Valor"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10"
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              type="month"
              value={form.mes}
              onChange={(e) => setForm({ ...form, mes: e.target.value })}
              className="bg-white/5 border-white/10 text-white h-10 [color-scheme:dark]"
            />
          </div>
          <div className="sm:col-span-1 flex items-center">
            <label className="flex items-center gap-1.5 text-xs text-white cursor-pointer" title="Recorre todo mês">
              <input
                type="checkbox"
                checked={form.recurring}
                onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
                className="h-4 w-4 accent-[#EA3935]"
              />
              Mensal
            </label>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button type="submit" disabled={criar.isPending} className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Adicionar custo
          </Button>
        </div>
      </form>

      {/* Lista */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02]">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Custos registrados</p>
        </div>
        {custos.length === 0 ? (
          <div className="p-10 text-center"><p className="text-sm text-muted-foreground">Nenhum custo registrado ainda.</p></div>
        ) : (
          <div className="divide-y divide-white/5">
            {custos.map((c) => {
              const cat = CATEGORIAS[c.category] ?? CATEGORIAS.outros;
              const CatIcon = cat.icon;
              return (
                <div
                  key={c.id}
                  onClick={() => setEditando(c)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') setEditando(c); }}
                  className="group flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                >
                  <div className={`w-9 h-9 rounded-xl ${cat.bg} flex items-center justify-center shrink-0`}>
                    <CatIcon className={`w-4 h-4 ${cat.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{c.description}</p>
                      {c.recurring && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                          <Repeat className="w-2.5 h-2.5" /> mensal
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{cat.label} · {competenciaLabel(c.competencia)}</p>
                  </div>
                  <p className="text-sm font-semibold text-white tabular-nums shrink-0">{formatBRL(c.amount)}</p>
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors shrink-0" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setExcluindo(c); }}
                    title="Remover"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editando && (
        <CustoEditModal
          custo={editando}
          isSaving={atualizar.isPending}
          onClose={() => setEditando(null)}
          onSave={(data) => atualizar.mutate({ id: editando.id, data })}
        />
      )}

      {excluindo && (
        <ConfirmArchiveDialog
          title={`Remover "${excluindo.description}"?`}
          description="O custo será removido permanentemente."
          confirmLabel="Remover"
          loadingLabel="Removendo..."
          tone="danger"
          onConfirm={() => excluir.mutate(excluindo.id)}
          onCancel={() => setExcluindo(null)}
          isLoading={excluir.isPending}
        />
      )}
    </div>
  );
}
