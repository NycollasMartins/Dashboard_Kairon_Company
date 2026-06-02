import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, XCircle, AlertTriangle, Loader2, Check, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { formatBRL, formatDateBR } from '../utils/contrato.format';

const MOTIVO_MAX = 300;

// Meses inteiros entre data_inicio do contrato e hoje, capeado em
// duracao_meses. Usado para sugerir quantas parcelas MRR ja entraram.
function mesesDecorridos(dataInicioISO) {
  if (!dataInicioISO) return 0;
  const [y, m, d] = String(dataInicioISO).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return 0;
  const inicio = new Date(y, m - 1, d);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diffMs = hoje.getTime() - inicio.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375));
}

function sugestaoTotalRecebido(contrato) {
  if (!contrato) return 0;
  const valor = Number(contrato.valor) || 0;
  if (contrato.tipo === 'TCV') return valor;
  const duracao = Number(contrato.duracao_meses) || 0;
  const meses = Math.min(duracao, mesesDecorridos(contrato.data_inicio));
  return Math.max(0, meses * valor);
}

export default function CancelarContratoModal({
  contrato,
  isSubmitting = false,
  onClose,
  onConfirm,
}) {
  const [motivo, setMotivo] = useState('');
  const sugestao = useMemo(() => sugestaoTotalRecebido(contrato), [contrato]);
  const [totalRecebido, setTotalRecebido] = useState(() => String(sugestao));
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const motivoTrim = motivo.trim();
  const motivoInvalid = submitted && motivoTrim.length === 0;
  const totalNum = Number(totalRecebido);
  const totalInvalid =
    submitted && (totalRecebido === '' || !Number.isFinite(totalNum) || totalNum < 0);
  const canSubmit =
    motivoTrim.length > 0 &&
    totalRecebido !== '' &&
    Number.isFinite(totalNum) &&
    totalNum >= 0 &&
    !isSubmitting;

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setSubmitted(true);
    if (!motivoTrim) return;
    if (totalRecebido === '' || !Number.isFinite(totalNum) || totalNum < 0) return;
    onConfirm({ motivo: motivoTrim, total_recebido: totalNum });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative glass-card border border-red-500/20 rounded-2xl w-full max-w-md z-10 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
              <XCircle className="w-4 h-4 text-red-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-tight">
                Cancelar contrato
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {contrato && (
            <div className="flex items-start gap-2 text-[12px] text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="text-white font-medium">
                  Contrato {contrato.tipo} — {formatBRL(contrato.valor)}
                  {contrato.tipo === 'MRR' ? '/mês' : ''}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Vigente de {formatDateBR(contrato.data_inicio)} a {formatDateBR(contrato.data_fim)}. Deixará de contar nas métricas a partir de hoje.
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
              Motivo do cancelamento <span className="text-[#EA3935]">*</span>
            </label>
            <Textarea
              placeholder="Ex: cliente solicitou pausa, mudança de escopo, churn antecipado..."
              value={motivo}
              maxLength={MOTIVO_MAX}
              onChange={(e) => setMotivo(e.target.value)}
              aria-invalid={motivoInvalid}
              className={`bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 min-h-[100px] resize-none ${
                motivoInvalid ? 'border-red-500/60 focus-visible:ring-red-500/30' : ''
              }`}
            />
            {motivoInvalid && (
              <p className="text-[11px] text-red-400 mt-1">Informe o motivo do cancelamento.</p>
            )}
            <p className="text-[10px] text-muted-foreground/70 text-right mt-1">
              {motivo.length}/{MOTIVO_MAX}
            </p>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
              <Coins className="w-3.5 h-3.5" />
              Total recebido neste contrato <span className="text-[#EA3935]">*</span>
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={totalRecebido}
              onChange={(e) => setTotalRecebido(e.target.value)}
              aria-invalid={totalInvalid}
              className={`bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10 ${
                totalInvalid ? 'border-red-500/60 focus-visible:ring-red-500/30' : ''
              }`}
            />
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Sugestão: {formatBRL(sugestao)}
              {contrato?.tipo === 'MRR' ? ' (parcelas já pagas até hoje)' : ' (valor cheio do TCV)'}.
              Ajuste se a empresa recebeu um valor diferente.
            </p>
            {totalInvalid && (
              <p className="text-[11px] text-red-400 mt-1">Informe o total recebido (use 0 se nada foi pago).</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 pb-5 pt-1">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            disabled={isSubmitting}
            className="flex-1 border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-white h-10"
          >
            Manter contrato
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 bg-red-500 hover:bg-red-600 border-0 text-white h-10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Cancelando...</>
            ) : (
              <><Check className="w-4 h-4 mr-1.5" /> Confirmar cancelamento</>
            )}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
