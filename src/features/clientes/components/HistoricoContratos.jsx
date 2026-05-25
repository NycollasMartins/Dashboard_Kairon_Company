import { useMemo } from 'react';
import { History, Repeat2 } from 'lucide-react';
import { formatBRL, formatDateBR, statusContratoConfig } from '../utils/contrato.format';

export default function HistoricoContratos({ contratos }) {
  const historicos = useMemo(
    () => (Array.isArray(contratos) ? contratos.filter((c) => c.status !== 'ativo') : []),
    [contratos]
  );

  const sorted = useMemo(
    () => [...historicos].sort((a, b) => {
      const da = new Date(a.data_inicio).getTime() || 0;
      const db = new Date(b.data_inicio).getTime() || 0;
      return db - da;
    }),
    [historicos]
  );

  if (sorted.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-white/5 p-6 flex flex-col items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <History className="w-4 h-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">Sem histórico de contratos anteriores.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-muted-foreground" />
          <h4 className="text-xs font-semibold text-white">Histórico de contratos</h4>
          <span className="text-[11px] text-muted-foreground">({sorted.length})</span>
        </div>
      </div>
      <div className="divide-y divide-white/5">
        {sorted.map((c) => {
          const cfg = statusContratoConfig(c.status);
          const valorLabel = c.tipo === 'MRR'
            ? `${formatBRL(c.valor)}/mês`
            : formatBRL(c.valor);
          return (
            <div key={c.id} className="px-5 py-3 grid grid-cols-[80px_1fr_auto] sm:grid-cols-[80px_minmax(0,1.4fr)_minmax(0,1.4fr)_auto] gap-3 items-center">
              <div>
                <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/90">
                  {c.tipo}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{valorLabel}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {formatDateBR(c.data_inicio)} → {formatDateBR(c.data_fim)} · {c.duracao_meses} {c.duracao_meses === 1 ? 'mês' : 'meses'}
                </p>
              </div>
              <div className="hidden sm:flex flex-col gap-0.5 min-w-0">
                {c.renovacao_de && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-300">
                    <Repeat2 className="w-3 h-3" /> Renovação de contrato anterior
                  </span>
                )}
                {c.status === 'cancelado' && c.motivo_cancelamento && (
                  <span className="text-[11px] text-red-300/90 truncate" title={c.motivo_cancelamento}>
                    Motivo: {c.motivo_cancelamento}
                  </span>
                )}
              </div>
              <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border font-medium ${cfg.bg} ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
