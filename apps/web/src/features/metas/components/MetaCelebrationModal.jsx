import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Rocket, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Pequenos "confetes" em posições/atrasos fixos (sem Math.random p/ não quebrar).
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: (i % 10) * 0.12,
  dur: 1.8 + (i % 5) * 0.25,
  color: ['#EA3935', '#34d399', '#fbbf24', '#60a5fa', '#a78bfa'][i % 5],
  size: 6 + (i % 4) * 2,
}));

// Popup global de "Meta batida!" — aparece para TODOS do dashboard.
export default function MetaCelebrationModal({ title, body, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[100] p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Confetes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {CONFETTI.map((c, i) => (
          <motion.span
            key={i}
            initial={{ y: -40, opacity: 0, rotate: 0 }}
            animate={{ y: '110vh', opacity: [0, 1, 1, 0.8], rotate: 360 }}
            transition={{ duration: c.dur, delay: c.delay, repeat: Infinity, ease: 'linear' }}
            style={{ left: `${c.left}%`, width: c.size, height: c.size, background: c.color }}
            className="absolute top-0 rounded-sm"
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}
        className="relative bg-[#15151c] border border-[#EA3935]/30 rounded-3xl w-full max-w-md z-10 shadow-2xl shadow-black/60 overflow-hidden"
      >
        <button type="button" onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
          <X className="w-4 h-4" />
        </button>

        <div className="px-7 pt-9 pb-7 text-center">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
            className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-400/20 to-[#EA3935]/20 border border-amber-300/30 flex items-center justify-center"
          >
            <Trophy className="w-10 h-10 text-amber-300" />
          </motion.div>

          <h2 className="text-2xl font-bold text-white mt-5 tracking-tight">{title || 'Meta do mês batida! 🎉'}</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {body || 'A meta do mês foi atingida. Parabéns ao time!'}
          </p>

          <div className="mt-5 rounded-2xl bg-[#EA3935]/[0.07] border border-[#EA3935]/20 p-4 text-left">
            <p className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Rocket className="w-4 h-4 text-[#EA3935]" /> Começou a Supermeta!
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Tudo que passar da meta entra na supermeta. Todo closer que vender daqui em diante
              ganha <span className="text-emerald-300 font-semibold">comissão dobrada (2×)</span>.
            </p>
          </div>

          <Button onClick={onClose} className="w-full mt-5 bg-[#EA3935] hover:bg-[#d32f2c] text-white">
            Bora pra supermeta! 🚀
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
