import { useMemo } from 'react';
import { History, FileText } from 'lucide-react';
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
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-3.5 h-3.5 text-muted-foreground" />
        <h4 className="text-sm font-semibold text-white">Histórico de contratos</h4>
        <span className="text-[11px] text-muted-foreground">({sorted.length})</span>
      </div>

      <div className="space-y-2.5">
        {sorted.map((c) => (
          <HistoricoCard key={c.id} contrato={c} />
        ))}
      </div>
    </div>
  );
}

function HistoricoCard({ contrato: c }) {
  const cfg = statusContratoConfig(c.status);
  const isMRR = c.tipo === 'MRR';
  const tipoSubtitle = isMRR ? 'Mensalidade recorrente' : 'Pagamento único';
  const valorSubtitle = isMRR ? 'por mês' : 'valor total';

  const teorico = isMRR
    ? (Number(c.valor) || 0) * (Number(c.duracao_meses) || 0)
    : Number(c.valor) || 0;
  const recebido = Number(c.total_recebido) || 0;
  const mostraRecebido = recebido !== teorico;

  return (
    <div className="glass-card rounded-xl border border-white/5 p-4 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h5 className="text-sm font-semibold text-white">Contrato {c.tipo}</h5>
              <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.bg} ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{tipoSubtitle}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-white tracking-tight leading-none">
            {formatBRL(c.valor)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">{valorSubtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-3 pt-3">
        <CompactField
          label="Vigência"
          value={`${formatDateBR(c.data_inicio)} → ${formatDateBR(c.data_fim)}`}
        />
        <CompactField
          label="Duração"
          value={`${c.duracao_meses} ${c.duracao_meses === 1 ? 'mês' : 'meses'}`}
        />
        {mostraRecebido && (
          <CompactField
            label="Total recebido"
            value={formatBRL(recebido)}
            accent="text-emerald-300"
          />
        )}
      </div>

      {c.status === 'cancelado' && c.motivo_cancelamento && (
        <p
          className="text-[11px] text-red-300/90 mt-3 pt-3 border-t border-white/5 truncate"
          title={c.motivo_cancelamento}
        >
          <span className="text-muted-foreground/80">Motivo: </span>
          {c.motivo_cancelamento}
        </p>
      )}
    </div>
  );
}

function CompactField({ label, value, accent = 'text-white' }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-0.5">
        {label}
      </p>
      <p
        className={`text-xs font-medium truncate ${accent}`}
        title={typeof value === 'string' ? value : undefined}
      >
        {value}
      </p>
    </div>
  );
}
