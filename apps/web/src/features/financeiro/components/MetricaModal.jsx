import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { X, TrendingUp, CalendarDays } from 'lucide-react';
import { MES_LABELS } from '@/features/financeiro/lib/financeiro.calc';

const ACCENTS = {
  emerald: { hex: '#34d399', text: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  red: { hex: '#EA3935', text: 'text-[#EA3935]', bg: 'bg-[#EA3935]/10' },
  blue: { hex: '#60a5fa', text: 'text-blue-300', bg: 'bg-blue-500/10' },
  purple: { hex: '#a78bfa', text: 'text-purple-300', bg: 'bg-purple-500/10' },
};

export default function MetricaModal({ metrica, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!metrica) return null;

  const {
    title, icon: Icon, accent = 'red', format = (v) => v, series = [],
    chartType = 'area', annualLabel = 'Total no ano', annualValue, subtitle,
  } = metrica;
  const a = ACCENTS[accent] ?? ACCENTS.red;

  const data = series.map((valor, i) => ({ mes: MES_LABELS[i], valor }));
  const nonZero = series.filter((v) => v !== 0);
  const media = nonZero.length ? series.reduce((s, v) => s + v, 0) / 12 : 0;
  let melhorIdx = 0;
  series.forEach((v, i) => { if (v > series[melhorIdx]) melhorIdx = i; });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-card border border-white/10 rounded-xl p-2.5 text-xs">
          <p className="text-white font-medium mb-0.5">{label}</p>
          <p style={{ color: a.hex }}>{format(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative glass-card border border-white/10 rounded-2xl w-full max-w-2xl z-10 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl ${a.bg} flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${a.text}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-tight">{title}</h3>
              <p className="text-[11px] text-muted-foreground">{subtitle ?? 'Evolução mês a mês'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Total do ano + stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className={`glass-card rounded-2xl border border-white/5 p-4 ${a.bg}`}>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{annualLabel}</p>
              <p className="text-2xl font-semibold text-white tracking-tight mt-1 tabular-nums">{format(annualValue)}</p>
            </div>
            <div className="glass-card rounded-2xl border border-white/5 p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <CalendarDays className="w-3 h-3 text-muted-foreground" />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Média/mês</p>
              </div>
              <p className="text-2xl font-semibold text-white tracking-tight tabular-nums">{format(media)}</p>
            </div>
            <div className="glass-card rounded-2xl border border-white/5 p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3 h-3 text-muted-foreground" />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Melhor mês</p>
              </div>
              <p className="text-base font-semibold text-white tracking-tight mt-1">
                {MES_LABELS[melhorIdx]} <span className="text-xs text-muted-foreground">· {format(series[melhorIdx])}</span>
              </p>
            </div>
          </div>

          {/* Gráfico */}
          <div className="glass-card rounded-2xl border border-white/5 p-4">
            <ResponsiveContainer width="100%" height={280}>
              {chartType === 'bar' ? (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="valor" name={title} fill={a.hex} radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id={`grad-${accent}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={a.hex} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={a.hex} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="valor" name={title} stroke={a.hex} strokeWidth={2} fill={`url(#grad-${accent})`} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
