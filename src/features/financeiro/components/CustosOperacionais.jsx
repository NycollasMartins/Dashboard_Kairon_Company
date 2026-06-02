import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Trash2, Repeat, Users as UsersIcon, Wrench, Server, Landmark, Megaphone, Package, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
}

export default function CustosOperacionais() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();

  const [form, setForm] = useState({
    description: '',
    category: 'ferramentas',
    amount: '',
    mes: `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
    recurring: false,
  });
  const [excluindo, setExcluindo] = useState(null);

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

  const totais = useMemo(() => {
    const year = now.getFullYear();
    const serie = custoOperacionalSeriesYear(custos, year, now);
    const mes = serie[now.getMonth()];
    const ano = serie.reduce((a, b) => a + b, 0);
    const recorrenteMensal = custos
      .filter((c) => c.recurring)
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return { mes, ano, recorrenteMensal };
  }, [custos, now]);

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
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Custo operacional do mês</p>
          <p className="text-3xl font-semibold text-white tracking-tight mt-2 tabular-nums">{formatBRL(totais.mes)}</p>
        </div>
        <div className="glass-card rounded-2xl border border-white/5 p-6">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Custo no ano</p>
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
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
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
                  <button
                    type="button"
                    onClick={() => setExcluindo(c)}
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
