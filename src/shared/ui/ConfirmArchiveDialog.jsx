import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Archive, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ConfirmArchiveDialog({
  title = 'Arquivar?',
  description = 'O item ficará oculto da lista, mas o histórico é preservado. Você pode reativá-lo a qualquer momento.',
  confirmLabel = 'Arquivar',
  loadingLabel = 'Arquivando...',
  ConfirmIcon = Archive,
  tone = 'warning',
  onConfirm,
  onCancel,
  isLoading = false,
}) {
  const toneStyles = tone === 'danger'
    ? {
        card: 'border-red-500/20',
        iconBg: 'bg-red-500/10',
        iconColor: 'text-red-300',
        confirmButton:
          'bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-200 hover:text-red-100',
      }
    : {
        card: 'border-amber-500/20',
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-300',
        confirmButton:
          'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 hover:text-amber-100',
      };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !isLoading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, isLoading]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={isLoading ? undefined : onCancel}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className={`relative glass-card border ${toneStyles.card} rounded-2xl p-6 w-full max-w-sm z-10`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-xl ${toneStyles.iconBg} flex items-center justify-center shrink-0`}>
            <AlertTriangle className={`w-5 h-5 ${toneStyles.iconColor}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <Button
            onClick={onCancel}
            disabled={isLoading}
            variant="outline"
            className="flex-1 border-white/10 text-muted-foreground hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 ${toneStyles.confirmButton}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> {loadingLabel}
              </>
            ) : (
              <>
                <ConfirmIcon className="w-4 h-4 mr-1.5" /> {confirmLabel}
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
