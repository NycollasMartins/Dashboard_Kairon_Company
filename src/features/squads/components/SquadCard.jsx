import { motion } from 'framer-motion';
import { Edit2, Trash2, UserPlus, Wallet, UserCheck } from 'lucide-react';
import { formatBRL } from '@/features/clientes/utils/contrato.format';

export default function SquadCard({
  squad,
  membros = [],
  mrrTotal = 0,
  clientesAtivosCount = 0,
  index = 0,
  onClick,
  onEdit,
  onDelete,
}) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="glass-card rounded-2xl border border-white/5 p-5 flex flex-col gap-4 cursor-pointer hover:bg-white/[0.03] hover:border-white/10 transition-colors focus:outline-none focus:bg-white/[0.04] focus:border-white/15"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">{squad.nome}</p>
          {squad.descricao && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{squad.descricao}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            title="Editar squad"
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            title="Remover squad"
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="px-1">
          <div className="flex items-center gap-1.5 mb-1">
            <Wallet className="w-3 h-3 text-emerald-300" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">MRR</p>
          </div>
          <p className="text-sm font-semibold text-white tabular-nums truncate">
            {formatBRL(mrrTotal)}
            <span className="text-[10px] text-muted-foreground font-normal">/mês</span>
          </p>
        </div>
        <div className="px-1 border-l border-white/10 pl-4">
          <div className="flex items-center gap-1.5 mb-1">
            <UserCheck className="w-3 h-3 text-[#EA3935]" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Clientes ativos</p>
          </div>
          <p className="text-sm font-semibold text-white tabular-nums">{clientesAtivosCount}</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
          <UserPlus className="w-3 h-3" /> {membros.length} {membros.length === 1 ? 'membro' : 'membros'}
        </p>
        {membros.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Sem membros.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-white/10">
            {[...membros]
              .sort((a, b) =>
                (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '', 'pt-BR'),
              )
              .map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-2 py-2"
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: 'rgba(234, 57, 53,0.25)' }}
                  >
                    {u.full_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="text-xs text-muted-foreground truncate">{u.full_name || u.email}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
