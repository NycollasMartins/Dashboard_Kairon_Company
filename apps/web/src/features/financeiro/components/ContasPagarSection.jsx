import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check, Undo2, Search, ChevronLeft, ChevronRight, Info, Wallet, CircleDollarSign, AlertCircle,
  Users as UsersIcon, Wrench, Server, Landmark, Megaphone, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { pagamentosApi } from '@/features/financeiro/api/financeiro.api';
import { formatBRL } from '@/features/clientes/utils/contrato.format';
import { queryKeys } from '@/entities/query-keys';
import { MiniKpi, Painel } from './financeUi';

const CAT = {
  salarios: { label: 'Salários', icon: UsersIcon },
  ferramentas: { label: 'Ferramentas / SaaS', icon: Wrench },
  infraestrutura: { label: 'Infraestrutura', icon: Server },
  impostos: { label: 'Impostos', icon: Landmark },
  marketing: { label: 'Marketing', icon: Megaphone },
  outros: { label: 'Outros', icon: Package },
};
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export default function ContasPagarSection({ custos = [], pagamentos = [] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const now = new Date();
  const [ref, setRef] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [busca, setBusca] = useState('');

  const selMonth = ym(ref);                 // 'YYYY-MM'
  const selComp = `${selMonth}-01`;         // competência (dia 1)

  const invalidar = () => qc.invalidateQueries({ queryKey: queryKeys.financeiro.pagamentos });

  const mutPagar = useMutation({
    mutationFn: ({ custo, competencia }) => pagamentosApi.marcar({ custo_id: custo.id, competencia, valor: Number(custo.amount) || 0 }),
    onSuccess: invalidar,
    onError: (err) => toast({ variant: 'destructive', title: 'Não foi possível marcar', description: err?.message }),
  });
  const mutDesfazer = useMutation({
    mutationFn: ({ id }) => pagamentosApi.desmarcar(id),
    onSuccess: invalidar,
    onError: (err) => toast({ variant: 'destructive', title: 'Não foi possível desfazer', description: err?.message }),
  });

  // Pagamentos do mês selecionado, indexados por custo_id.
  const pagosDoMes = useMemo(() => {
    const map = new Map();
    for (const p of pagamentos) {
      if (String(p.competencia).slice(0, 7) === selMonth) map.set(p.custo_id, p);
    }
    return map;
  }, [pagamentos, selMonth]);

  // Custos MENSAIS (recorrentes) vigentes no mês selecionado (começaram até ele).
  const itens = useMemo(() => {
    const arr = (custos || [])
      .filter((c) => c.recurring && String(c.competencia).slice(0, 7) <= selMonth)
      .map((c) => ({ custo: c, pago: pagosDoMes.get(c.id) || null }));
    const q = busca.trim().toLowerCase();
    return arr
      .filter((it) => !q || (it.custo.description || '').toLowerCase().includes(q))
      .sort((a, b) => {
        if (!!a.pago !== !!b.pago) return a.pago ? 1 : -1; // pendentes primeiro
        return (b.custo.amount || 0) - (a.custo.amount || 0);
      });
  }, [custos, selMonth, pagosDoMes, busca]);

  const totais = useMemo(() => {
    let total = 0; let pago = 0;
    for (const c of custos || []) {
      if (!c.recurring || String(c.competencia).slice(0, 7) > selMonth) continue;
      const v = Number(c.amount) || 0;
      total += v;
      if (pagosDoMes.get(c.id)) pago += v;
    }
    return { total, pago, pendente: total - pago };
  }, [custos, selMonth, pagosDoMes]);

  const passado = ym(ref) < ym(new Date(now.getFullYear(), now.getMonth(), 1));
  const futuro = ym(ref) > ym(new Date(now.getFullYear(), now.getMonth(), 1));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
        <p>
          Controle de pagamento dos <span className="text-white">custos mensais</span> (salários, plataformas, infra…).
          A lista vem dos custos recorrentes da aba <span className="text-white">Custos Operacionais</span> — tudo que você adiciona lá aparece aqui automaticamente.
          Marque cada um como <span className="text-emerald-300">pago</span> no mês.
        </p>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() - 1, 1))}
            className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/5">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="min-w-[150px] text-center">
            <p className="text-sm font-semibold text-white">{MESES[ref.getMonth()]} / {ref.getFullYear()}</p>
            <p className="text-[10px] text-muted-foreground">{passado ? 'mês passado' : futuro ? 'mês futuro' : 'mês atual'}</p>
          </div>
          <button type="button" onClick={() => setRef(new Date(ref.getFullYear(), ref.getMonth() + 1, 1))}
            className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/5">
            <ChevronRight className="w-4 h-4" />
          </button>
          {(passado || futuro) && (
            <Button variant="ghost" className="h-8 text-[11px] text-muted-foreground hover:text-white" onClick={() => setRef(new Date(now.getFullYear(), now.getMonth(), 1))}>
              Voltar ao mês atual
            </Button>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniKpi icon={Wallet} label="Total mensal a pagar" value={formatBRL(totais.total)} accent="blue" hint="Soma dos custos recorrentes vigentes no mês." />
        <MiniKpi icon={CircleDollarSign} label="Pago no mês" value={formatBRL(totais.pago)} accent="emerald" />
        <MiniKpi icon={AlertCircle} label="Pendente no mês" value={formatBRL(totais.pendente)} accent={totais.pendente > 0 ? 'red' : 'emerald'} />
      </div>

      {/* Tabela */}
      <Painel title={`Custos mensais · ${MESES[ref.getMonth()]}/${ref.getFullYear()}`}>
        <div className="px-5 py-3 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar custo..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 h-9 text-white text-sm" />
          </div>
        </div>
        {itens.length === 0 ? (
          <div className="p-8 text-center"><p className="text-sm text-muted-foreground">Nenhum custo mensal neste mês. Cadastre custos recorrentes na aba Custos Operacionais.</p></div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[560px] overflow-auto">
            {itens.map(({ custo, pago }) => {
              const cat = CAT[custo.category] || CAT.outros;
              const Icon = cat.icon;
              return (
                <div key={custo.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{custo.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {cat.label}{pago?.pago_em ? ` · pago ${new Date(pago.pago_em).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border ${pago ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' : 'bg-amber-500/15 text-amber-300 border-amber-500/25'}`}>
                    {pago ? 'Pago' : 'Pendente'}
                  </span>
                  <p className="text-sm font-semibold text-white tabular-nums shrink-0 w-24 text-right">{formatBRL(custo.amount)}</p>
                  <div className="shrink-0 w-24 flex justify-end">
                    {pago ? (
                      <Button variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground hover:text-white" disabled={mutDesfazer.isPending}
                        onClick={() => mutDesfazer.mutate({ id: pago.id })}>
                        <Undo2 className="w-3 h-3 mr-1" /> Desfazer
                      </Button>
                    ) : (
                      <Button className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-600/90" disabled={mutPagar.isPending}
                        onClick={() => mutPagar.mutate({ custo, competencia: selComp })}>
                        <Check className="w-3 h-3 mr-1" /> Pago
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Painel>
    </div>
  );
}
