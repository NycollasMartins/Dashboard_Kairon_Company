import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CheckSquare, Folder, TrendingUp, Clock, AlertTriangle,
  CheckCircle2, Calendar, Flag, Zap, Target, Star, LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { tarefasApi } from '@/features/tarefas/api/tarefas.api';
import { projetosApi } from '@/features/projetos/api/projetos.api';
import { squadsApi } from '@/features/squads/api/squads.api';
import { queryKeys } from '@/entities/query-keys';

const prioridadeConfig = {
  baixa: { label: 'Baixa', color: 'text-slate-400', dot: 'bg-slate-400' },
  media: { label: 'Média', color: 'text-blue-400', dot: 'bg-blue-400' },
  alta: { label: 'Alta', color: 'text-red-400', dot: 'bg-red-400' },
  urgente: { label: 'Urgente', color: 'text-red-400', dot: 'bg-red-400' },
};

function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

function isVencendoHoje(prazo) { return prazo === getTodayStr(); }
function isAtrasada(prazo) { return prazo && prazo < getTodayStr(); }

export default function VisaoGeralPage() {
  const { user } = useAuth();

  const { data: todasTarefas = [] } = useQuery({
    queryKey: queryKeys.tarefas.all,
    queryFn: tarefasApi.list,
  });

  const { data: projetos = [] } = useQuery({
    queryKey: queryKeys.projetos.all,
    queryFn: projetosApi.list,
  });

  const { data: squads = [] } = useQuery({
    queryKey: queryKeys.squads.all,
    queryFn: squadsApi.list,
  });

  const primeiroNome = user?.full_name?.split(' ')[0] || 'você';

  const minhasTarefas = todasTarefas.filter((t) => t.responsavel_id === user?.id);
  const tarefasHoje = minhasTarefas.filter((t) => t.prazo === getTodayStr() && t.status !== 'concluida');
  const tarefasPendentes = minhasTarefas.filter((t) => t.status !== 'concluida');
  const tarefasConcluidas = minhasTarefas.filter((t) => t.status === 'concluida');
  const tarefasAtrasadas = minhasTarefas.filter((t) => isAtrasada(t.prazo) && t.status !== 'concluida');
  const tarefasEmAndamento = minhasTarefas.filter((t) => t.status === 'em_andamento');

  const meuSquad = squads.find((s) => s.squad_membros?.some((sm) => sm.profile_id === user?.id));
  const projetosDoSquad = projetos.filter((p) => p.status === 'ativo');

  const alertas = [];
  if (tarefasAtrasadas.length > 0) {
    alertas.push({
      icon: AlertTriangle,
      msg: `${tarefasAtrasadas.length} tarefa${tarefasAtrasadas.length > 1 ? 's' : ''} em atraso`,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
    });
  }
  const tarefasUrgentes = minhasTarefas.filter((t) => t.prioridade === 'urgente' && t.status !== 'concluida');
  if (tarefasUrgentes.length > 0) {
    alertas.push({
      icon: Zap,
      msg: `${tarefasUrgentes.length} tarefa${tarefasUrgentes.length > 1 ? 's' : ''} com prioridade urgente`,
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10 border-yellow-500/20',
    });
  }
  const tarefasVencendoHoje = minhasTarefas.filter((t) => isVencendoHoje(t.prazo) && t.status !== 'concluida');
  if (tarefasVencendoHoje.length > 0) {
    alertas.push({
      icon: Clock,
      msg: `${tarefasVencendoHoje.length} tarefa${tarefasVencendoHoje.length > 1 ? 's' : ''} vencem hoje`,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    });
  }

  const totalMes = minhasTarefas.length;
  const pctConclusao = totalMes > 0 ? Math.round((tarefasConcluidas.length / totalMes) * 100) : 0;

  const metricas = [
    { label: 'Taxa de Conclusão', value: `${pctConclusao}%`, sub: `${tarefasConcluidas.length} de ${totalMes} tarefas`, icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Em Andamento', value: tarefasEmAndamento.length, sub: 'tarefas ativas agora', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Pendentes', value: tarefasPendentes.length, sub: 'aguardando início', icon: Clock, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    { label: 'Concluídas', value: tarefasConcluidas.length, sub: 'tarefas finalizadas', icon: Star, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  ];

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const hojeCapitalized = hoje.charAt(0).toUpperCase() + hoje.slice(1);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="-mt-24 -mx-6">
        <div
          className="relative h-44 rounded-b-3xl overflow-hidden"
          style={{
            backgroundImage: "url('/kairon-company-dark.png')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/75 pointer-events-none" />
        </div>

        <div className="px-6 -mt-10 relative">
          <div className="w-20 h-20 rounded-full bg-[#0d0d0d] border-2 border-white/10 flex items-center justify-center shadow-xl shadow-black/50">
            <LayoutDashboard className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="px-6 mt-4 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div>
            <h1 className="text-[1.7rem] font-bold text-white tracking-tight">
              {saudacao()}, <span className="text-gradient">{primeiroNome}!</span> 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {hojeCapitalized}
              {' · '}
              {tarefasHoje.length > 0
                ? `${tarefasHoje.length} tarefa${tarefasHoje.length > 1 ? 's' : ''} para hoje${tarefasAtrasadas.length > 0 ? ` e ${tarefasAtrasadas.length} em atraso` : ''}.`
                : tarefasPendentes.length > 0
                ? `${tarefasPendentes.length} pendente${tarefasPendentes.length > 1 ? 's' : ''} no escopo.`
                : 'Tudo em dia. 🎉'}
            </p>
          </div>

          <blockquote className="lg:max-w-md lg:text-right border-l-2 lg:border-l-0 lg:border-r-2 border-white/15 pl-4 lg:pl-0 lg:pr-4 py-1">
            <p className="italic text-[#c2c5cc] text-[0.95rem] leading-snug">
              “Escreva a visão, torne-a bem legível sobre tábuas, para que possa
              ser lida até por quem passa correndo.”
            </p>
            <footer className="not-italic text-[#88070f] text-sm font-semibold mt-1.5 tracking-wide">
              Habacuque 2:2
            </footer>
          </blockquote>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((alerta, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${alerta.bg}`}
            >
              <alerta.icon className={`w-4 h-4 shrink-0 ${alerta.color}`} />
              <p className={`text-sm font-medium ${alerta.color}`}>{alerta.msg}</p>
            </motion.div>
          ))}
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Performance do Mês</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metricas.map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`glass-card rounded-2xl border p-4 ${m.bg}`}
            >
              <div className="flex items-center justify-between mb-3">
                <m.icon className={`w-4 h-4 ${m.color}`} />
              </div>
              <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
              <p className="text-xs font-semibold text-white mt-0.5">{m.label}</p>
              <p className="text-xs text-muted-foreground">{m.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <CheckSquare className="w-3.5 h-3.5 text-[#EA3935]" />
            Tarefas para Hoje
            {tarefasHoje.length > 0 && (
              <span className="bg-[#EA3935]/20 text-[#EA3935] px-1.5 py-0.5 rounded-md text-xs font-bold">{tarefasHoje.length}</span>
            )}
          </p>
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
            {tarefasHoje.length === 0 ? (
              <div className="p-8 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <p className="text-sm font-medium text-white">Sem tarefas para hoje</p>
                <p className="text-xs text-muted-foreground">Aproveite ou antecipe demandas futuras.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {tarefasHoje.map((t, i) => {
                  const prio = prioridadeConfig[t.prioridade] || prioridadeConfig.media;
                  return (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${prio.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{t.titulo}</p>
                        {t.clientes?.nome && <p className="text-xs text-muted-foreground truncate">{t.clientes.nome}</p>}
                      </div>
                      <span className={`text-xs ${prio.color} shrink-0`}>{prio.label}</span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {tarefasAtrasadas.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Em Atraso
              </p>
              <div className="glass-card rounded-2xl border border-red-500/20 overflow-hidden">
                <div className="divide-y divide-white/5">
                  {tarefasAtrasadas.slice(0, 4).map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{t.titulo}</p>
                        <p className="text-xs text-red-400">Vencia em {t.prazo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Folder className="w-3.5 h-3.5 text-[#EA3935]" />
            Projetos Ativos
            {meuSquad && <span className="text-muted-foreground font-normal normal-case">— {meuSquad.nome}</span>}
          </p>
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
            {projetosDoSquad.length === 0 ? (
              <div className="p-8 flex flex-col items-center gap-2">
                <Folder className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm font-medium text-white">Nenhum projeto ativo</p>
                <p className="text-xs text-muted-foreground">Projetos do seu squad aparecerão aqui.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {projetosDoSquad.slice(0, 6).map((p, i) => {
                  const tarefasDoProjeto = todasTarefas.filter((t) => t.projeto_id === p.id);
                  const concluidas = tarefasDoProjeto.filter((t) => t.status === 'concluida').length;
                  const pct = tarefasDoProjeto.length > 0 ? Math.round((concluidas / tarefasDoProjeto.length) * 100) : 0;

                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{p.nome}</p>
                          {p.clientes?.nome && <p className="text-xs text-muted-foreground truncate">{p.clientes.nome}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {p.prazo && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />{p.prazo}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      </div>
                      {tarefasDoProjeto.length > 0 && (
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-[#EA3935] rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
