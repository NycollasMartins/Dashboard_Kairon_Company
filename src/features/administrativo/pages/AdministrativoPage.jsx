import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Shield, Edit2, Check, UserPlus, Send, X, Clock, RotateCcw } from 'lucide-react';
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
import { queryKeys } from '@/entities/query-keys';
import { useAuth } from '@/features/auth/context/AuthContext';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';

const BRAND_FROM = '#EA3935';
const BRAND_TO = '#C12D29';

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
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const { data: usuariosRaw = [] } = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: usersApi.list,
  });

  const { data: convites = [] } = useQuery({
    queryKey: queryKeys.convitesPendentes.all,
    queryFn: async () => {
      try {
        return await invitesApi.list();
      } catch {
        // view ainda não criada no Supabase — degrada para "sem convites pendentes"
        return [];
      }
    },
  });

  const pendingIds = new Set(convites.map((c) => c.id));
  const usuarios = usuariosRaw.filter((u) => !pendingIds.has(u.id));

  const atualizar = useMutation({
    mutationFn: ({ id, role }) => usersApi.update(id, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      setEditandoId(null);
      toast({ title: 'Papel atualizado!' });
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
      qc.invalidateQueries({ queryKey: queryKeys.convitesPendentes.all });
      toast({ title: 'Convite cancelado.' });
    },
    onError: (err) => {
      toast({ title: 'Erro ao cancelar', description: err?.message, variant: 'destructive' });
    },
  });

  const counts = Object.keys(roleConfig).reduce((acc, key) => {
    if (key === 'sdr') {
      acc[key] = usuarios.filter((u) => !u.role || u.role === 'sdr').length;
    } else {
      acc[key] = usuarios.filter((u) => u.role === key).length;
    }
    return acc;
  }, {});

  const handleEditar = (u) => {
    if (!isAdmin) return;
    setEditandoId(u.id);
    setNovoRole(u.role || 'sdr');
  };

  const handleCancelar = (convite) => {
    if (!window.confirm(`Cancelar o convite de ${convite.email}?`)) return;
    cancelar.mutate(convite.id);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#EA3935]" /> Controle de Níveis de Acesso
          </h2>
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

      {convites.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" /> Convites Pendentes
            <span className="text-xs font-normal text-muted-foreground">({convites.length})</span>
          </h2>
          <div className="glass-card rounded-2xl border border-amber-500/15 overflow-hidden">
            <div className="divide-y divide-white/5">
              {convites.map((c, i) => {
                const cfg = roleConfig[c.role] || roleConfig.sdr;
                const Icon = cfg.icon;
                const isResending = reenviar.isPending && reenviar.variables === c.email;
                const isCanceling = cancelar.isPending && cancelar.variables === c.id;
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold text-sm shrink-0"
                      style={{ background: 'rgba(245, 158, 11, 0.2)' }}
                    >
                      {c.full_name?.[0]?.toUpperCase() || c.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-white truncate">{c.full_name || '—'}</p>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/20">
                          <Clock className="w-2.5 h-2.5" /> Aguardando aceite
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${cfg.bg} ${cfg.color}`}
                    >
                      <Icon className="w-3 h-3" /> {cfg.label}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => reenviar.mutate(c.email)}
                        disabled={isResending}
                        title="Reenviar convite"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 transition-colors disabled:opacity-50"
                      >
                        {isResending ? (
                          <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCancelar(c)}
                        disabled={isCanceling}
                        title="Cancelar convite"
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-base font-semibold text-white mb-4">Usuários do Sistema</h2>
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          {usuarios.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground text-sm">Nenhum usuário cadastrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {usuarios.map((u, i) => {
                const cfg = roleConfig[u.role] || roleConfig.sdr;
                const Icon = cfg.icon;
                const isEditando = editandoId === u.id;
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
                      style={{ background: 'rgba(234, 57, 53,0.2)' }}
                    >
                      {u.full_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{u.full_name || '—'}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>

                    {isEditando && isAdmin ? (
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
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${cfg.bg} ${cfg.color} ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                        onClick={isAdmin ? () => handleEditar(u) : undefined}
                      >
                        <Icon className="w-3 h-3" /> {cfg.label}
                        {isAdmin && <Edit2 className="w-2.5 h-2.5 ml-1 opacity-60" />}
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
    </div>
  );
}
