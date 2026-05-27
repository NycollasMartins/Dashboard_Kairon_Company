import { useMemo } from 'react';
import { Wallet, TrendingUp, BadgeDollarSign, ChevronRight } from 'lucide-react';
import { mrrDoCliente, tcvHistorico, ltvEstimado } from '@/features/clientes/api/contratos.api';
import { formatBRL } from '@/features/clientes/utils/contrato.format';

function MiniStat({ icon: Icon, label, value, accent = 'text-[#EA3935]', bgAccent = 'bg-[#EA3935]/10' }) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgAccent}`}>
          <Icon className={`w-4 h-4 ${accent}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="text-base font-semibold text-white tracking-tight truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function SquadFinanceiroSection({ clientes = [], onVerCliente }) {
  const { mrrTotal, tcvTotal, ltvTotal, breakdown } = useMemo(() => {
    let mrr = 0;
    let tcv = 0;
    let ltv = 0;
    const rows = [];
    for (const c of clientes) {
      const cMrr = mrrDoCliente(c.contratos);
      const cTcv = tcvHistorico(c.contratos);
      const cLtv = ltvEstimado(c.contratos);
      mrr += cMrr;
      tcv += cTcv;
      ltv += cLtv;
      rows.push({ cliente: c, mrr: cMrr, tcv: cTcv, ltv: cLtv });
    }
    rows.sort((a, b) => b.mrr - a.mrr);
    return { mrrTotal: mrr, tcvTotal: tcv, ltvTotal: ltv, breakdown: rows };
  }, [clientes]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniStat
          icon={Wallet}
          label="MRR ativo total"
          value={`${formatBRL(mrrTotal)}/mês`}
          accent="text-emerald-300"
          bgAccent="bg-emerald-500/10"
        />
        <MiniStat
          icon={BadgeDollarSign}
          label="TCV histórico"
          value={formatBRL(tcvTotal)}
          accent="text-blue-300"
          bgAccent="bg-blue-500/10"
        />
        <MiniStat
          icon={TrendingUp}
          label="LTV estimado"
          value={formatBRL(ltvTotal)}
          accent="text-[#EA3935]"
          bgAccent="bg-[#EA3935]/10"
        />
      </div>

      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02]">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            Top clientes por MRR
          </p>
        </div>

        {breakdown.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum cliente vinculado a este squad.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {breakdown.map(({ cliente, mrr, tcv }) => {
              const isChurn = cliente.status === 'churn';
              return (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => onVerCliente?.(cliente.id)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-[#EA3935]/15 border border-[#EA3935]/60 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    {cliente.nome?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">{cliente.nome}</p>
                      {isChurn && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/25">
                          Churn
                        </span>
                      )}
                    </div>
                    {cliente.empresa && (
                      <p className="text-xs text-muted-foreground truncate">{cliente.empresa}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-white tabular-nums">
                      {formatBRL(mrr)}
                      <span className="text-[10px] text-muted-foreground font-normal">/mês</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">TCV {formatBRL(tcv)}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
