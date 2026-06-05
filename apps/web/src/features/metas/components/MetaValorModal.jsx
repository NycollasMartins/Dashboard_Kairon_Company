import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Target, Loader2, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatBRL } from '@/features/clientes/utils/contrato.format';

// Define o valor de uma meta (global do mês ou individual de um closer).
export default function MetaValorModal({
  title = 'Definir meta',
  subtitle,
  currentValue = 0,
  isSubmitting = false,
  onClose,
  onConfirm,
}) {
  const [valor, setValor] = useState(currentValue ? String(currentValue) : '');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valorNum = Number(valor);
  const invalid = submitted && (!Number.isFinite(valorNum) || valorNum <= 0);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setSubmitted(true);
    if (!Number.isFinite(valorNum) || valorNum <= 0) return;
    onConfirm(valorNum);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative bg-[#15151c] border border-white/10 rounded-2xl w-full max-w-sm z-10 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#EA3935]/15">
              <Target className="w-4 h-4 text-[#EA3935]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">{title}</h2>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
            <Coins className="w-3.5 h-3.5" /> Valor da meta (R$) <span className="text-[#EA3935]">*</span>
          </label>
          <Input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className={invalid ? 'border-[#EA3935]' : ''}
            autoFocus
          />
          {Number.isFinite(valorNum) && valorNum > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">{formatBRL(valorNum)}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/5">
          <Button type="button" variant="outline" onClick={onClose} className="border-white/10 bg-transparent text-white hover:bg-white/5">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-[#EA3935] hover:bg-[#d32f2c] text-white">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar meta'}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
