import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Shield,
  Edit2,
  Check,
  UserPlus,
  Send,
  X,
  Clock,
  RotateCcw,
  Archive,
  Trash2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { usersApi } from '@/features/administrativo/api/users.api';
import { invitesApi } from '@/features/administrativo/api/invites.api';
import { roleConfig } from '@/features/administrativo/lib/roleConfig';
import InviteUserDialog from '@/features/administrativo/components/InviteUserDialog';
import DeleteUserDialog from '@/features/administrativo/components/DeleteUserDialog';
import { queryKeys } from '@/entities/query-keys';
import { useAuth } from '@/features/auth/context/AuthContext';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';

const BRAND_FROM = '#EA3935';
const BRAND_TO = '#C12D29';

const TABS = [
  { key: 'ativos', label: 'Ativos' },
  { key: 'arquivados', label: 'Arquivados' },
  { key: 'pendentes', label: 'Pendentes' },
];

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

export default function AdministrativoPage() {
  const { user: currentUser } = useAuth();
  if (currentUser?.role !== 'admin') {
    return (
      <RestrictedAccessCard
        description="Apenas usuários com perfil admin podem acessar Administrativo."
      />
    );
  }
  return <AdministrativoPageContent />;
}

function AdministrativoPageContent() {
  const [editandoId, setEditandoId] = useState(null);
  const [novoRole, setNovoRole] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [aba, setAba] = useState('ativos');
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const { data: usuariosRaw = [] } = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: usersApi.list,
  });

  const ativos = useMemo(
    () => usuariosRaw.filter((u) => u.status === 'active'),
    [usuariosRaw],
  );
  const arquivados = useMemo(
    () => usuariosRaw.filter((u) => u.status === 'archived'),
    [usuariosRaw],
  );
  const pendentes = useMemo(
    () => usuariosRaw.filter((u) => u.status === 'pending'),
    [usuariosRaw],
  );

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
    qc.invalidateQueries({ queryKey: queryKeys.convitesPendentes.all });
  };

  const atualizar = useMutation({
    mutationFn: ({ id, role }) => usersApi.update(id, { role }),
    onSuccess: () => {
      invalidateAll();
      setEditandoId(null);
      toast({ title: 'Papel atualizado!' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao atualizar', description: err?.message, variant: 'destructive' });
    },
  });

  const arquivar = useMutation({
    mutationFn: (id) => usersApi.archive(id),
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Usuário arquivado.', description: 'O acesso foi bloqueado.' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao arquivar', description: err?.message, variant: 'destructive' });
    },
  });

  const restaurar = useMutation({
    mutationFn: (id) => usersApi.unarchive(id),
    onSuccess: () => {
      invalidateAll();
      toast({
        title: 'Usuário restaurado.',
        description: 'Lembre-se de readicioná-lo aos squads necessários.',
      });
    },
    onError: (err) => {
      toast({ title: 'Erro ao restaurar', description: err?.message, variant: 'destructive' });
    },
  });

  const reenviar = useMutation({
    mutationFn: (email) => invitesApi.resend(email),
    onSuccess: (_data, email) => {
      toast({ title: 'Convite reenviado!', description: `Novo e-mail enviado para ${email}.` });
    },
    onError: (err) => {
      toast({ title: 'Erro ao reenviar', description: err?.message, variant: 'destructive' });
    },
  });

  const cancelar = useMutation({
    mutationFn: (id) => invitesApi.cancel(id),
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Convite cancelado.' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao cancelar', description: err?.message, variant: 'destructive' });
    },
  });

  const counts = Object.keys(roleConfig).reduce((acc, key) => {
    if (key === 'sdr') {
      acc[key] = ativos.filter((u) => !u.role || u.role === 'sdr').length;
    } else {
      acc[key] = ativos.filter((u) => u.role === key).length;
    }
    return acc;
  }, {});

  const handleEditar = (u) => {
    if (!isAdmin) return;
    setEditandoId(u.id);
    setNovoRole(u.role || 'sdr');
  };

  const handleArquivar = (u) => {
    if (!window.confirm(`Arquivar o acesso de ${u.full_name || u.email}? O login será bloqueado imediatamente.`)) return;
    arquivar.mutate(u.id);
  };

  const handleCancelarConvite = (convite) => {
    if (!window.confirm(`Cancelar o convite de ${convite.email}?`)) return;
    cancelar.mutate(convite.id);
  };

  const tabCounts = { ativos: ativos.length, arquivados: arquivados.length, pendentes: pendentes.length };
  const lista = aba === 'ativos' ? ativos : aba === 'arquivados' ? arquivados : pendentes;

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
            <Shield className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="px-6 mt-4">
          <h1 className="text-[1.7rem] font-bold text-white tracking-tight">Membros</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Controle de níveis de acesso, convites e gestão de usuários do sistema.
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-end mb-4 gap-3 flex-wrap">
          {isAdmin && (
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md shadow-[#EA3935]/25 transition-opacity hover:opacity-[0.97]"
              style={{ background: `linear-gradient(135deg, ${BRAND_FROM}, ${BRAND_TO})` }}
            >
              <UserPlus className="w-4 h-4" />
              Convidar Usuário
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(roleConfig).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div key={key} className={`glass-card rounded-2xl p-5 border ${cfg.bg}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-xl ${cfg.bg}`}><Icon className={`w-5 h-5 ${cfg.color}`} /></div>
                  <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{cfg.desc}</p>
                <p className="text-2xl font-bold text-white">
                  {counts[key]} <span className="text-xs font-normal text-muted-foreground">usuários</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-white">Usuários do Sistema</h2>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            {TABS.map((t) => {
              const active = aba === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setAba(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {t.label}
                  <span className={`ml-1.5 text-[10px] font-normal ${active ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {tabCounts[t.key]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          {lista.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground text-sm">
                {aba === 'ativos' && 'Nenhum usuário ativo.'}
                {aba === 'arquivados' && 'Nenhum usuário arquivado.'}
                {aba === 'pendentes' && 'Nenhum convite pendente.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {lista.map((u, i) => {
                const cfg = roleConfig[u.role] || roleConfig.sdr;
                const Icon = cfg.icon;
                const isSelf = currentUser?.id === u.id;

                if (aba === 'pendentes') {
                  const isResending = reenviar.isPending && reenviar.variables === u.email;
                  const isCanceling = cancelar.isPending && cancelar.variables === u.id;
                  return (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0"
                        style={{ background: 'rgba(245, 158, 11, 0.2)' }}
                      >
                        {u.full_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-white truncate">{u.full_name || '—'}</p>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20">
                            <Clock className="w-2.5 h-2.5" /> Aguardando aceite
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>

                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => reenviar.mutate(u.email)}
                          disabled={isResending}
                          title="Reenviar convite"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors disabled:opacity-50"
                        >
                          {isResending ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleCancelarConvite(u)}
                          disabled={isCanceling}
                          title="Cancelar convite"
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                }

                const isArchived = aba === 'arquivados';
                const isEditando = editandoId === u.id;
                const archivingThis = arquivar.isPending && arquivar.variables === u.id;
                const restoringThis = restaurar.isPending && restaurar.variables === u.id;

                return (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors ${isArchived ? 'opacity-75' : ''}`}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0"
                      style={{
                        background: isArchived
                          ? 'rgba(113,113,122,0.25)'
                          : 'rgba(234, 57, 53,0.2)',
                      }}
                    >
                      {u.full_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-white truncate">{u.full_name || '—'}</p>
                        {isArchived && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-500/15 text-zinc-300 border border-zinc-500/20">
                            <Archive className="w-2.5 h-2.5" /> Arquivado em {formatDate(u.archived_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>

                    {isEditando && isAdmin && !isArchived ? (
                      <div className="flex items-center gap-2">
                        <Select value={novoRole} onValueChange={setNovoRole}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-xs w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#1a1a2e] border-white/10">
                            {Object.entries(roleConfig).map(([key, cfg]) => (
                              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => atualizar.mutate({ id: u.id, role: novoRole })}
                          className="p-1.5 rounded-lg bg-[#EA3935]/20 hover:bg-[#EA3935]/40 text-[#EA3935] transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${cfg.bg} ${cfg.color} ${isAdmin && !isArchived ? 'cursor-pointer' : 'cursor-default'}`}
                        onClick={isAdmin && !isArchived ? () => handleEditar(u) : undefined}
                      >
                        <Icon className="w-3 h-3" /> {cfg.label}
                        {isAdmin && !isArchived && <Edit2 className="w-2.5 h-2.5 ml-1 opacity-60" />}
                      </div>
                    )}

                    {isAdmin && !isSelf && (
                      <div className="flex items-center gap-1">
                        {isArchived ? (
                          <>
                            <button
                              onClick={() => restaurar.mutate(u.id)}
                              disabled={restoringThis}
                              title="Restaurar usuário"
                              className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition-colors disabled:opacity-50"
                            >
                              <RotateCcw className={`w-3.5 h-3.5 ${restoringThis ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(u)}
                              title="Excluir permanentemente"
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleArquivar(u)}
                            disabled={archivingThis}
                            title="Arquivar usuário"
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors disabled:opacity-50"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <DeleteUserDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        user={deleteTarget || {}}
      />
    </div>
  );
}
