// Componentes visuais compartilhados da aba Financeiro (cards, painéis, helpers).
import { ChevronRight } from 'lucide-react';

export const fmtInt = (v) => Math.round(Number(v) || 0).toLocaleString('pt-BR');
export const fmtPct = (v) => `${(Number(v) || 0).toFixed(1).replace('.', ',')}%`;
export const fmtMult = (v) => `${(Number(v) || 0).toFixed(1).replace('.', ',')}×`;
export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export const ACCENTS = {
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', hex: '#34d399' },
  blue: { text: 'text-blue-300', bg: 'bg-blue-500/10', hex: '#60a5fa' },
  red: { text: 'text-[#EA3935]', bg: 'bg-[#EA3935]/10', hex: '#EA3935' },
  purple: { text: 'text-purple-300', bg: 'bg-purple-500/10', hex: '#a78bfa' },
  amber: { text: 'text-amber-300', bg: 'bg-amber-500/10', hex: '#fbbf24' },
};

export function KpiCard({ icon: Icon, label, value, sub, accent = 'red', onClick }) {
  const a = ACCENTS[accent] ?? ACCENTS.red;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left glass-card rounded-2xl border border-white/5 p-6 hover:border-white/10 hover:bg-white/[0.02] transition-colors w-full"
    >
      <div className="flex items-start justify-between">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <div className={`w-9 h-9 rounded-xl ${a.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${a.text}`} />
        </div>
      </div>
      <p className="text-4xl font-semibold text-white tracking-tight leading-none tabular-nums mt-3">{value}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-muted-foreground">{sub}</p>
        {onClick && (
          <span className="text-[11px] text-muted-foreground/60 group-hover:text-muted-foreground inline-flex items-center gap-0.5">
            ver detalhes <ChevronRight className="w-3 h-3" />
          </span>
        )}
      </div>
    </button>
  );
}

export function MiniKpi({ icon: Icon, label, value, accent = 'red', hint = '', badge = '' }) {
  const a = ACCENTS[accent] ?? ACCENTS.red;
  return (
    <div className={`glass-card rounded-2xl border border-white/5 p-4 ${hint ? 'cursor-help' : ''}`} title={hint || undefined}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${a.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${a.text}`} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            {badge && (
              <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">{badge}</span>
            )}
          </div>
          <p className="text-lg font-semibold text-white tracking-tight truncate tabular-nums">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function Painel({ title, children, action }) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}
