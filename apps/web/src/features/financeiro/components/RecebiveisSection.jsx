import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, AlertTriangle, Clock, PiggyBank, Check, Undo2, Search, Landmark, Info, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import { parcelasApi, financeConfigApi } from '@/features/financeiro/api/financeiro.api';
import { formatBRL } from '@/features/clientes/utils/contrato.format';
import { queryKeys } from '@/entities/query-keys';
import {
  recebiveis, cronogramaReceber, caixaRecebidoSeriesYear, saldoCaixa, sum, parseDateLocal,
} from '@/features/financeiro/lib/financeiro.calc';
import { MiniKpi, Painel, fmtPct } from './financeUi';

const hojeISO = () => new Date().toISOString().slice(0, 10);
const MES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function statusVisual(p, now) {
  if (p.pago_em && p.status === 'pago') return { label: 'Pago', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' };
  if (p.status === 'estornado') return { label: 'Estornado', cls: 'bg-white/5 text-muted-foreground border-white/10' };
  if (p.status === 'falhou') return { label: 'Falhou', cls: 'bg-[#EA3935]/15 text-[#EA3935] border-[#EA3935]/25' };
  const venc = parseDateLocal(p.vencimento);
  if (venc && venc < now) return { label: 'Vencido', cls: 'bg-[#EA3935]/15 text-[#EA3935] border-[#EA3935]/25' };
  return { label: 'Em aberto', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25' };
}

export default function RecebiveisSection({ parcelas = [], config, custos = [], metrics = [], year }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const now = new Date();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todas'); // todas | abertas | vencidas | pagas
  const [saldoEdit, setSaldoEdit] = useState(null); // string em edição
  const [excluindo, setExcluindo] = useState(null); // parcela em confirmação de exclusão

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: queryKeys.financeiro.parcelas });
    qc.invalidateQueries({ queryKey: queryKeys.financeiro.config });
  };

  const mutPago = useMutation({
    mutationFn: ({ id }) => parcelasApi.marcarPago(id, { pago_em: hojeISO() }),
    onSuccess: invalidar,
  });
  const mutAberto = useMutation({
    mutationFn: ({ id }) => parcelasApi.marcarAberto(id),
    onSuccess: invalidar,
  });
  const mutSaldo = useMutation({
    mutationFn: (saldo_inicial) => financeConfigApi.update({ saldo_inicial, saldo_inicial_data: config?.saldo_inicial_data || hojeISO() }),
    onSuccess: () => { invalidar(); setSaldoEdit(null); },
  });
  const mutExcluir = useMutation({
    mutationFn: (id) => parcelasApi.remove(id),
    onSuccess: () => { invalidar(); setExcluindo(null); toast({ title: 'Parcela removida.' }); },
    onError: (err) => toast({ variant: 'destructive', title: 'Não foi possível remover', description: err?.message }),
  });

  const calc = useMemo(() => {
    const r = recebiveis(parcelas, now);
    const caixaSerie = caixaRecebidoSeriesYear(parcelas, year);
    const recebidoAno = sum(caixaSerie);
    const recebidoMes = caixaSerie[now.getMonth()] || 0;
    const cron = cronogramaReceber(parcelas, now, 12);
    const saldo = saldoCaixa({
      parcelas, custos, metrics,
      saldoInicial: Number(config?.saldo_inicial) || 0,
      saldoInicialData: config?.saldo_inicial_data || null,
      year, now,
    });
    return { ...r, recebidoAno, recebidoMes, cron, saldoAtual: saldo.saldoAtual };
  }, [parcelas, custos, metrics, config, year, now]);

  const linhas = useMemo(() => {
    let arr = parcelas.slice();
    if (filtro === 'abertas') arr = arr.filter((p) => !p.pago_em && p.status === 'em_aberto');
    else if (filtro === 'pagas') arr = arr.filter((p) => p.pago_em);
    else if (filtro === 'vencidas') arr = arr.filter((p) => !p.pago_em && p.status === 'em_aberto' && parseDateLocal(p.vencimento) < now);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter((p) => (p.cliente?.nome || '').toLowerCase().includes(q));
    }
    // vencidas/abertas primeiro, depois por vencimento
    return arr.sort((a, b) => {
      const pa = a.pago_em ? 1 : 0; const pb = b.pago_em ? 1 : 0;
      if (pa !== pb) return pa - pb;
      return String(a.vencimento).localeCompare(String(b.vencimento));
    }).slice(0, 200);
  }, [parcelas, filtro, busca, now]);

  const FILTROS = [
    { id: 'todas', label: 'Todas' },
    { id: 'abertas', label: 'Em aberto' },
    { id: 'vencidas', label: 'Vencidas' },
    { id: 'pagas', label: 'Pagas' },
  ];

  return (
    <div className="space-y-6">
      {/* Aviso de dependência do dado */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-white/[0.02] border border-white/5 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-blue-300 shrink-0 mt-0.5" />
        <p>
          Inadimplência e <span className="text-white">caixa real</span> dependem do pagamento estar registrado.
          Marque cada parcela recebida como <span className="text-emerald-300">paga</span> abaixo. O histórico foi
          pré-preenchido a partir do <span className="text-white">total recebido</span> de cada contrato.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniKpi icon={Wallet} label="Caixa recebido (ano)" value={formatBRL(calc.recebidoAno)} accent="emerald" hint="Soma das parcelas efetivamente pagas no ano." />
        <MiniKpi icon={Clock} label="A receber (em aberto)" value={formatBRL(calc.emAberto)} accent="blue" hint="Parcelas ainda não pagas (vencidas + a vencer)." />
        <MiniKpi icon={AlertTriangle} label={`Inadimplência (${fmtPct(calc.inadimplenciaPct)})`} value={formatBRL(calc.inadimplencia)} accent={calc.inadimplencia > 0 ? 'red' : 'emerald'} hint="Parcelas vencidas e não pagas. % sobre o total já vencido (pago + em aberto)." />
        <MiniKpi icon={PiggyBank} label="Saldo de caixa" value={formatBRL(calc.saldoAtual)} accent={calc.saldoAtual >= 0 ? 'emerald' : 'red'} hint="Saldo inicial + entradas (parcelas pagas) − saídas (custos + ads) acumulado." />
      </div>

      {/* Saldo inicial + cronograma */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Painel title="Saldo inicial de caixa">
          <div className="p-5 space-y-3">
            <p className="text-xs text-muted-foreground">
              Informe o saldo de caixa na data de referência. O saldo de caixa acima passa a acumular o fluxo a partir dele.
            </p>
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-muted-foreground shrink-0" />
              {saldoEdit === null ? (
                <>
                  <span className="text-2xl font-semibold text-white tabular-nums">{formatBRL(config?.saldo_inicial || 0)}</span>
                  <Button variant="outline" className="ml-auto h-8 border-white/10 bg-transparent text-white hover:bg-white/5" onClick={() => setSaldoEdit(String(config?.saldo_inicial ?? 0))}>Editar</Button>
                </>
              ) : (
                <>
                  <input
                    type="number" step="0.01" value={saldoEdit} onChange={(e) => setSaldoEdit(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 h-9 text-white text-sm tabular-nums"
                    autoFocus
                  />
                  <Button className="h-9 bg-[#EA3935] hover:bg-[#EA3935]/90" disabled={mutSaldo.isPending} onClick={() => mutSaldo.mutate(Number(saldoEdit) || 0)}>Salvar</Button>
                  <Button variant="ghost" className="h-9 text-muted-foreground" onClick={() => setSaldoEdit(null)}>Cancelar</Button>
                </>
              )}
            </div>
            {config?.saldo_inicial_data && (
              <p className="text-[11px] text-muted-foreground">Data de referência: {new Date(config.saldo_inicial_data).toLocaleDateString('pt-BR')}</p>
            )}
          </div>
        </Painel>

        <div className="lg:col-span-2">
          <Painel title="Contas a receber · próximos meses">
            {calc.cron.length === 0 ? (
              <div className="p-8 text-center"><p className="text-sm text-muted-foreground">Nada em aberto.</p></div>
            ) : (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {calc.cron.map((c) => {
                  const [yy, mm] = c.competencia.split('-').map(Number);
                  return (
                    <div key={c.competencia} className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <p className="text-[11px] text-muted-foreground">{MES_LABELS[mm - 1]}/{String(yy).slice(2)}</p>
                      <p className="text-sm font-semibold text-white tabular-nums mt-0.5">{formatBRL(c.valor)}</p>
                      <p className="text-[10px] text-muted-foreground">{c.qtd} parcela{c.qtd > 1 ? 's' : ''}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </Painel>
        </div>
      </div>

      {/* Tabela de parcelas */}
      <Painel
        title="Parcelas"
        action={(
          <div className="flex items-center gap-1">
            {FILTROS.map((f) => (
              <button key={f.id} type="button" onClick={() => setFiltro(f.id)}
                className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${filtro === f.id ? 'bg-white/10 text-white border-white/20' : 'text-muted-foreground border-transparent hover:text-white'}`}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      >
        <div className="px-5 py-3 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 h-9 text-white text-sm" />
          </div>
        </div>
        {linhas.length === 0 ? (
          <div className="p-8 text-center"><p className="text-sm text-muted-foreground">Nenhuma parcela.</p></div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[520px] overflow-auto">
            {linhas.map((p) => {
              const sv = statusVisual(p, now);
              const pago = !!p.pago_em;
              return (
                <div key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{p.cliente?.nome || 'Cliente'}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.contrato?.tipo || '—'} · venc. {new Date(p.vencimento).toLocaleDateString('pt-BR')}
                      {pago && p.pago_em ? ` · pago ${new Date(p.pago_em).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border ${sv.cls}`}>{sv.label}</span>
                  <p className="text-sm font-semibold text-white tabular-nums shrink-0 w-24 text-right">{formatBRL(p.valor)}</p>
                  <div className="shrink-0 w-24 flex justify-end">
                    {pago ? (
                      <Button variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground hover:text-white" disabled={mutAberto.isPending}
                        onClick={() => mutAberto.mutate({ id: p.id })}>
                        <Undo2 className="w-3 h-3 mr-1" /> Desfazer
                      </Button>
                    ) : (p.status === 'em_aberto' && (
                      <Button className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-600/90" disabled={mutPago.isPending}
                        onClick={() => mutPago.mutate({ id: p.id })}>
                        <Check className="w-3 h-3 mr-1" /> Pago
                      </Button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setExcluindo(p)} title="Remover parcela"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-300 hover:bg-red-500/10 transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Painel>

      {excluindo && (
        <ConfirmArchiveDialog
          title="Remover esta parcela?"
          description={`${excluindo.cliente?.nome || 'Cliente'} · ${formatBRL(excluindo.valor)} · venc. ${new Date(excluindo.vencimento).toLocaleDateString('pt-BR')}. A parcela será removida permanentemente.`}
          confirmLabel="Remover"
          loadingLabel="Removendo..."
          tone="danger"
          onConfirm={() => mutExcluir.mutate(excluindo.id)}
          onCancel={() => setExcluindo(null)}
          isLoading={mutExcluir.isPending}
        />
      )}
    </div>
  );
}
