import { motion } from 'framer-motion';
import { UserPlus, CheckCircle2, AlertCircle, Mail } from 'lucide-react';

const atividades = [
  { icon: UserPlus, text: 'Novo lead: Empresa Alpha', time: '2 min atrás', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { icon: CheckCircle2, text: 'Tarefa "Campanha Q2" concluída', time: '15 min atrás', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  { icon: Mail, text: 'Email disparado para 120 leads', time: '1h atrás', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { icon: AlertCircle, text: 'Prazo próximo: Relatório mensal', time: '2h atrás', color: 'text-pink-400', bg: 'bg-pink-500/10' },
  { icon: CheckCircle2, text: 'Cliente Beta convertido', time: '3h atrás', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
];

export default function AtividadesRecentes() {
  return (
    <div className="glass-card rounded-2xl p-5 border border-white/5">
      <h3 className="text-sm font-semibold text-white mb-5">Atividades Recentes</h3>
      <div className="space-y-3">
        {atividades.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div className={`p-2 rounded-lg ${a.bg} shrink-0`}>
                <Icon className={`w-3.5 h-3.5 ${a.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/90 truncate">{a.text}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.time}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}