import {
  FileText, Calendar, Coins, Repeat2, XCircle, AlertTriangle, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBRL, formatDateBR, diasAteFim, statusContratoConfig } from '../utils/contrato.format';

const ALERTA_DIAS = 30;

export default function ContratoCard({ contrato, canManage, onRenovar, onCancelar }) {
  if (!contrato) return null;

  const cfg = statusContratoConfig(contrato.status);
  const dias = diasAteFim(contrato.data_fim);
  const proximoFim = contrato.status === 'ativo' && dias != null && dias <= ALERTA_DIAS;
  const isAtivo = contrato.status === 'ativo';

  const valorLabel = contrato.tipo === 'MRR'
    ? `${formatBRL(contrato.valor)}/mês`
    : `${formatBRL(contrato.valor)} (total)`;

  return (
    <div className="glass-card rounded-2xl border border-white/10 p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#EA3935]/15 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-[#EA3935]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-white">Contrato {contrato.tipo}</h3>
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
            <p className="text-xs text-muted-foreground mt-0.5">
              Vigência: {formatDateBR(contrato.data_inicio)} → {formatDateBR(contrato.data_fim)} · {contrato.duracao_meses} {contrato.duracao_meses === 1 ? 'mês' : 'meses'}
            </p>
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              onClick={onRenovar}
              variant="outline"
              className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white h-9 px-3 text-xs gap-1.5"
            >
              <Repeat2 className="w-3.5 h-3.5" /> Renovar
            </Button>
            {isAtivo && (
              <Button
                type="button"
                onClick={onCancelar}
                variant="outline"
                className="border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:text-red-200 h-9 px-3 text-xs gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancelar
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoTile icon={Coins} label="Valor" value={valorLabel} accent="text-emerald-300" />
        <InfoTile icon={Calendar} label="Início" value={formatDateBR(contrato.data_inicio)} />
        <InfoTile icon={Calendar} label="Encerra em" value={formatDateBR(contrato.data_fim)} />
      </div>

      {Array.isArray(contrato.entregaveis) && contrato.entregaveis.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">
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
        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-white/10 pl-3 italic">
          {contrato.notas}
        </p>
      )}
    </div>
  );
}

function InfoTile({ icon: Icon, label, value, accent = 'text-white' }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-xl px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium mb-0.5">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className={`text-sm font-semibold ${accent}`}>{value}</p>
    </div>
  );
}
