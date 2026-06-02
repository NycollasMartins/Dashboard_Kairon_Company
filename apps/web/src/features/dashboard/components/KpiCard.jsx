import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function KpiCard({ title, value, trend, trendValue, icon: Icon, color, delay = 0 }) {
  const isPositive = trend === 'up';
  const colors = {
    purple: 'border-[rgba(234, 57, 53,0.25)]',
    pink: 'border-[rgba(234, 57, 53,0.2)]',
    blue: 'border-[rgba(234, 57, 53,0.15)]',
    emerald: 'border-emerald-500/20',
  };
  const iconColors = {
    purple: 'bg-[rgba(234, 57, 53,0.15)]',
    pink: 'bg-[rgba(234, 57, 53,0.12)]',
    blue: 'bg-[rgba(234, 57, 53,0.10)]',
    emerald: 'text-emerald-400 bg-emerald-500/20',
  };
  const iconTextColors = {
    purple: '#EA3935',
    pink: '#EA3935',
    blue: '#EA3935',
    emerald: '',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`glass-card rounded-2xl p-5 border ${colors[color]} hover:border-opacity-60 transition-all duration-300`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${iconColors[color]}`}>
          <Icon className="w-5 h-5" style={iconTextColors[color] ? {color: iconTextColors[color]} : {}} />
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {trendValue}
        </div>
      </div>
      <p className="text-2xl font-bold text-white mb-1">{value}</p>
      <p className="text-xs text-muted-foreground">{title}</p>
    </motion.div>
  );
}