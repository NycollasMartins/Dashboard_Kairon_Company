import {
  FileText, XCircle, AlertTriangle, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBRL, formatDateBR, diasAteFim, statusContratoConfig } from '../utils/contrato.format';

const ALERTA_DIAS = 30;

export default function ContratoCard({ contrato, canManage, onCancelar }) {
  if (!contrato) return null;

  const cfg = statusContratoConfig(contrato.status);
  const dias = diasAteFim(contrato.data_fim);
  const proximoFim = contrato.status === 'ativo' && dias != null && dias <= ALERTA_DIAS;
  const isAtivo = contrato.status === 'ativo';
  const isMRR = contrato.tipo === 'MRR';

  const tipoSubtitle = isMRR ? 'Mensalidade recorrente' : 'Pagamento único';
  const valorSubtitle = isMRR ? 'por mês' : 'valor total';
  const restanteLabel = dias == null
    ? '—'
    : dias <= 0
      ? 'Encerrado'
      : `${dias} ${dias === 1 ? 'dia' : 'dias'}`;

  return (
    <div className="glass-card rounded-2xl border border-white/10 p-6 hover:border-white/15 transition-colors">
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-[#EA3935]/15 border border-[#EA3935]/25 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-[#EA3935]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-white tracking-tight">
                Contrato {contrato.tipo}
              </h3>
              <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border font-medium ${cfg.bg} ${cfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
              {proximoFim && (
                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  {dias <= 0 ? 'Encerra hoje' : `${dias} ${dias === 1 ? 'dia' : 'dias'} restantes`}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">{tipoSubtitle}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-white tracking-tight leading-none">
            {formatBRL(contrato.valor)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1.5">{valorSubtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 pt-5">
        <Field
          label="Vigência"
          value={`${formatDateBR(contrato.data_inicio)} → ${formatDateBR(contrato.data_fim)}`}
        />
        <Field
          label="Duração"
          value={`${contrato.duracao_meses} ${contrato.duracao_meses === 1 ? 'mês' : 'meses'}`}
        />
        <Field
          label={dias != null && dias <= 0 ? 'Status' : 'Restante'}
          value={restanteLabel}
          accent={proximoFim ? 'text-amber-300' : 'text-white'}
        />
      </div>

      {Array.isArray(contrato.entregaveis) && contrato.entregaveis.length > 0 && (
        <div className="pt-5 mt-5 border-t border-white/5">
          <p className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            <Package className="w-3 h-3" /> Entregáveis
          </p>
          <div className="flex flex-wrap gap-1.5">
            {contrato.entregaveis.map((e) => (
              <span
                key={e}
                className="px-2.5 py-1 rounded-md bg-[#EA3935]/10 border border-[#EA3935]/25 text-[11px] text-white"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {contrato.notas && (
        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-white/10 pl-3 italic mt-5">
          {contrato.notas}
        </p>
      )}

      {canManage && isAtivo && (
        <div className="flex justify-end pt-5 mt-5 border-t border-white/5">
          <Button
            type="button"
            onClick={onCancelar}
            variant="outline"
            className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 h-9 px-3.5 text-xs gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" /> Cancelar contrato
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, accent = 'text-white' }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-1">
        {label}
      </p>
      <p className={`text-sm font-medium truncate ${accent}`} title={typeof value === 'string' ? value : undefined}>
        {value}
      </p>
    </div>
  );
}
