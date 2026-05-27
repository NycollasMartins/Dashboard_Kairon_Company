import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Edit2, Trash2, Layers, Wallet, UserCheck, Users,
  ChevronRight, Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import SquadForm from '@/features/squads/components/SquadForm';
import SquadFinanceiroSection from '@/features/squads/components/SquadFinanceiroSection';
import { squadsApi } from '@/features/squads/api/squads.api';
import { squadMembrosApi } from '@/features/squads/api/squad-membros.api';
import { usersApi } from '@/features/administrativo/api/users.api';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { mrrDoCliente } from '@/features/clientes/api/contratos.api';
import { formatBRL } from '@/features/clientes/utils/contrato.format';
import { queryKeys } from '@/entities/query-keys';

function StatCard({ icon: Icon, label, value, accent = 'text-[#EA3935]' }) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 p-6 hover:border-white/10 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-3.5 h-3.5 ${accent}`} />
        <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="text-4xl font-semibold text-white tracking-tight leading-none tabular-nums truncate">
        {value}
      </p>
    </div>
  );
}

const roleColors = {
  admin: 'bg-[#EA3935]/10 text-[#EA3935] border-[#EA3935]/25',
  head: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
  cs: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
  'social media': 'bg-amber-500/10 text-amber-300 border-amber-500/25',
  designer: 'bg-pink-500/10 text-pink-300 border-pink-500/25',
};

function RoleBadge({ role }) {
  if (!role) return null;
  const cls = roleColors[role] ?? 'bg-white/5 text-muted-foreground border-white/10';
  return (
    <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border font-medium ${cls}`}>
      {role}
    </span>
  );
}

export default function SquadDetalhePage({ squadId, onBack, onVerCliente }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [tab, setTab] = useState('clientes');
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const qc = useQueryClient();

  const { data: squad, isLoading } = useQuery({
    queryKey: queryKeys.squads.detail(squadId),
    queryFn: () => squadsApi.get(squadId),
    enabled: !!squadId,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: queryKeys.clientes.all,
    queryFn: clientesApi.list,
  });

  const { data: usuariosRaw = [] } = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: usersApi.list,
  });
  const usuarios = usuariosRaw.filter((u) => u.status === 'active');

  const clientesDoSquad = useMemo(
    () =>
      clientes
        .filter((c) => c.squad_id === squadId)
        .sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')),
    [clientes, squadId],
  );

  const stats = useMemo(() => {
    let mrr = 0;
    let ativos = 0;
    for (const c of clientesDoSquad) {
      if (c.status === 'ativo') {
        ativos += 1;
        mrr += mrrDoCliente(c.contratos);
      }
    }
    return { mrr, ativos, total: clientesDoSquad.length };
  }, [clientesDoSquad]);

  const membros = useMemo(
    () => squad?.squad_membros?.map((sm) => sm.profiles).filter(Boolean) ?? [],
    [squad],
  );

  const atualizar = useMutation({
    mutationFn: async ({ nome, descricao, membros_ids }) => {
      const updated = await squadsApi.update(squadId, { nome, descricao });
      await squadMembrosApi.setMembros(squadId, membros_ids);
      return updated;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.squads.detail(squadId) });
      qc.invalidateQueries({ queryKey: queryKeys.squads.all });
      setShowEdit(false);
      toast({ title: 'Squad atualizado!' });
    },
  });

  const deletar = useMutation({
    mutationFn: () => squadsApi.delete(squadId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.squads.all });
      setShowConfirmDelete(false);
      toast({ title: 'Squad removido.' });
      onBack();
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível remover o squad',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#EA3935]/30 border-t-[#EA3935] rounded-full animate-spin" />
      </div>
    );
  }

  if (!squad) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-sm">Squad não encontrado.</p>
        <Button onClick={onBack} variant="outline" className="mt-4 border-white/10 text-muted-foreground">
          Voltar
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: 'clientes', label: 'Clientes' },
    { id: 'membros', label: 'Membros' },
    ...(isAdmin ? [{ id: 'financeiro', label: 'Financeiro' }] : []),
  ];

  return (
    <div className="space-y-16 animate-fade-in">
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
          <div className="absolute inset-0 flex items-start justify-between p-4 pt-24">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-black/30 hover:bg-black/50 border border-white/10 text-white/80 hover:text-white backdrop-blur transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowEdit(true)}
                variant="outline"
                className="border-white/15 bg-black/30 backdrop-blur text-white hover:bg-black/50 hover:text-white h-9 px-4 text-xs gap-2"
              >
                <Edit2 className="w-3.5 h-3.5" /> Editar
              </Button>
              <Button
                onClick={() => setShowConfirmDelete(true)}
                className="bg-[#EA3935]/20 hover:bg-[#EA3935]/35 border border-[#EA3935]/40 text-white backdrop-blur h-9 px-4 text-xs gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remover
              </Button>
            </div>
          </div>
        </div>

        <div className="px-6 -mt-10 relative">
          <div className="w-20 h-20 rounded-full bg-[#0d0d0d] border-2 border-white/10 flex items-center justify-center shadow-xl shadow-black/50">
            <Layers className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="px-6 mt-4">
          <h1 className="text-[1.7rem] font-bold text-white tracking-tight">{squad.nome}</h1>
          {squad.descricao && (
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{squad.descricao}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={Wallet}
          label="MRR Total"
          value={`${formatBRL(stats.mrr)}/mês`}
          accent="text-emerald-300"
        />
        <StatCard
          icon={UserCheck}
          label="Clientes ativos"
          value={stats.ativos}
          accent="text-[#EA3935]"
        />
        <StatCard
          icon={Users}
          label="Membros"
          value={membros.length}
          accent="text-slate-300"
        />
      </div>

      <div>
        <div className="flex items-center gap-6 border-b border-white/10 mb-6">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  active
                    ? 'text-white border-[#EA3935]'
                    : 'text-muted-foreground border-transparent hover:text-white'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'clientes' && (
          <ClientesTab clientes={clientesDoSquad} onVerCliente={onVerCliente} />
        )}

        {tab === 'membros' && (
          <MembrosTab membros={membros} />
        )}

        {tab === 'financeiro' && isAdmin && (
          <SquadFinanceiroSection clientes={clientesDoSquad} onVerCliente={onVerCliente} />
        )}
      </div>

      {showEdit && (
        <SquadForm
          squad={squad}
          usuarios={usuarios}
          onClose={() => setShowEdit(false)}
          onSave={(form) => atualizar.mutate(form)}
        />
      )}

      {showConfirmDelete && (
        <ConfirmArchiveDialog
          title={`Remover squad ${squad.nome}?`}
          description="Os clientes vinculados a este squad ficarão sem squad atribuído. O histórico não é apagado, mas a associação é desfeita."
          confirmLabel="Remover squad"
          loadingLabel="Removendo..."
          ConfirmIcon={Trash2}
          tone="danger"
          onConfirm={() => deletar.mutate()}
          onCancel={() => setShowConfirmDelete(false)}
          isLoading={deletar.isPending}
        />
      )}
    </div>
  );
}

function ClientesTab({ clientes, onVerCliente }) {
  if (clientes.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-white/5 p-12 text-center">
        <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-muted-foreground text-sm">Nenhum cliente vinculado a este squad.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
      <div className="hidden md:grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_120px_140px_40px] gap-4 px-5 py-3 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/5 bg-white/[0.02]">
        <div>Cliente</div>
        <div>Origem</div>
        <div>Status</div>
        <div className="text-right">MRR</div>
        <div />
      </div>

      <div className="divide-y divide-white/5">
        {clientes.map((c, i) => {
          const isChurn = c.status === 'churn';
          const mrr = mrrDoCliente(c.contratos);
          return (
            <motion.button
              key={c.id}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.2) }}
              onClick={() => onVerCliente?.(c.id)}
              className="w-full text-left group hover:bg-white/[0.03] transition-colors focus:outline-none focus:bg-white/[0.04]"
            >
              <div className="md:grid md:grid-cols-[minmax(0,1.8fr)_minmax(0,1.2fr)_120px_140px_40px] gap-4 px-5 py-4 flex flex-col items-center">
                <div className="flex items-center gap-3 min-w-0 w-full">
                  <div className="w-9 h-9 rounded-full bg-[#EA3935]/15 border border-[#EA3935]/60 flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-md shadow-black/40">
                    {c.nome?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{c.nome}</p>
                    {c.email && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 shrink-0" /> {c.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center min-w-0 w-full">
                  {c.origem === 'lead' ? (
                    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border bg-emerald-500/10 text-emerald-300 border-emerald-500/25">
                      Lead
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded border bg-white/5 text-muted-foreground border-white/10">
                      Manual
                    </span>
                  )}
                </div>

                <div className="flex items-center w-full">
                  {isChurn ? (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg border font-medium bg-red-500/10 border-red-500/20 text-red-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Churn
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg border font-medium bg-emerald-500/10 border-emerald-500/20 text-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Ativo
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end w-full">
                  {mrr > 0 ? (
                    <p className="text-sm font-semibold text-white tabular-nums">
                      {formatBRL(mrr)}
                      <span className="text-[10px] text-muted-foreground font-normal">/mês</span>
                    </p>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">—</span>
                  )}
                </div>

                <div className="hidden md:flex items-center justify-end">
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function MembrosTab({ membros }) {
  if (membros.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-white/5 p-12 text-center">
        <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-muted-foreground text-sm">Nenhum membro vinculado a este squad.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {membros.map((m, i) => (
        <motion.div
          key={m.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.03, 0.2) }}
          className="glass-card rounded-2xl border border-white/5 p-4 flex items-center gap-3"
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{ background: 'rgba(234, 57, 53,0.25)' }}
          >
            {m.full_name?.[0]?.toUpperCase() || m.email?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-medium text-white truncate">{m.full_name || '—'}</p>
              <RoleBadge role={m.role} />
            </div>
            {m.email && (
              <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <Mail className="w-3 h-3 shrink-0" /> {m.email}
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
