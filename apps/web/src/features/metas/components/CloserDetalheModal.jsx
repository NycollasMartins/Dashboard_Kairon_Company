import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Trophy, Target, TrendingUp, Pencil, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/features/clientes/utils/contrato.format';
import { progressoPct, faltaParaMeta, metaBatida } from '../lib/metas.calc';

// Popup com a meta individual do closer e quanto falta para ele bater.
export default function CloserDetalheModal({ entry, posicao, isAdmin = false, onClose, onEditMeta }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!entry) return null;

  const pct = progressoPct(entry.total, entry.meta);
  const pctClamp = Math.min(100, Math.max(0, pct));
  const falta = faltaParaMeta(entry.total, entry.meta);
  const batida = metaBatida(entry.total, entry.meta);
  const temMeta = Number(entry.meta) > 0;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative bg-[#15151c] border border-white/10 rounded-2xl w-full max-w-md z-10 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#EA3935]/15 border border-[#EA3935]/60 flex items-center justify-center text-white font-semibold">
              {entry.nome?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-1.5">
                {entry.nome}
                {posicao === 1 && <Trophy className="w-4 h-4 text-amber-300" />}
              </h2>
              <p className="text-xs text-muted-foreground">{entry.count} venda{entry.count === 1 ? '' : 's'} no mês · {posicao}º no ranking</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-card rounded-xl border border-white/5 p-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Vendido</p>
              <p className="text-lg font-semibold text-white tabular-nums mt-1">{formatBRL(entry.total)}</p>
            </div>
            <div className="glass-card rounded-xl border border-white/5 p-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" /> Meta</p>
              <p className="text-lg font-semibold text-white tabular-nums mt-1">{temMeta ? formatBRL(entry.meta) : '—'}</p>
            </div>
            <div className="glass-card rounded-xl border border-white/5 p-3">
              <p className="text-[11px] text-muted-foreground">Falta</p>
              <p className={`text-lg font-semibold tabular-nums mt-1 ${batida ? 'text-emerald-300' : 'text-white'}`}>
                {temMeta ? (batida ? formatBRL(0) : formatBRL(falta)) : '—'}
              </p>
            </div>
          </div>

          {temMeta ? (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">Progresso da meta individual</span>
                <span className={`text-xs font-semibold tabular-nums ${batida ? 'text-emerald-300' : 'text-[#EA3935]'}`}>{pct.toFixed(1)}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${batida ? 'bg-emerald-400' : 'bg-[#EA3935]'}`}
                  style={{ width: `${pctClamp}%` }}
                />
              </div>
              {batida && (
                <p className="text-xs text-emerald-300 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Meta individual batida!
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Nenhuma meta individual definida para este closer.' : 'Sem meta individual definida.'}
            </p>
          )}
        </div>

        {isAdmin && (
          <div className="flex items-center justify-end px-6 py-4 border-t border-white/5">
            <Button type="button" onClick={() => onEditMeta?.(entry)} className="bg-[#EA3935] hover:bg-[#d32f2c] text-white">
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> {temMeta ? 'Editar meta individual' : 'Definir meta individual'}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
