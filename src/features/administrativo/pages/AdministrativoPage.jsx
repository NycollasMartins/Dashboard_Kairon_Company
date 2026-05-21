import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Shield, Crown, Briefcase, User, Edit2, Check, UserCheck } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { usersApi } from '@/features/administrativo/api/users.api';
import { queryKeys } from '@/entities/query-keys';
import { useAuth } from '@/features/auth/context/AuthContext';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';

const roleConfig = {
  admin: { label: 'Admin', icon: Crown, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', desc: 'Acesso total ao sistema' },
  'social media': { label: 'Social Media', icon: Briefcase, color: 'text-[#EA3935]', bg: 'bg-red-500/10 border-red-500/20', desc: 'Gestão de redes sociais' },
  closer: { label: 'Closer', icon: User, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', desc: 'Fechamento de vendas' },
  sdr: { label: 'SDR', icon: UserCheck, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', desc: 'Prospecção e qualificação' },
  bdr: { label: 'BDR', icon: UserCheck, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', desc: 'Geração de demanda outbound' },
};

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
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const { data: usuarios = [] } = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: usersApi.list,
  });

  const atualizar = useMutation({
    mutationFn: ({ id, role }) => usersApi.update(id, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      setEditandoId(null);
      toast({ title: 'Papel atualizado!' });
    },
  });

  const counts = {
    admin: usuarios.filter((u) => u.role === 'admin').length,
    'social media': usuarios.filter((u) => u.role === 'social media').length,
    closer: usuarios.filter((u) => u.role === 'closer').length,
    sdr: usuarios.filter((u) => !u.role || u.role === 'sdr').length,
  };

  const handleEditar = (u) => {
    if (!isAdmin) return;
    setEditandoId(u.id);
    setNovoRole(u.role || 'sdr');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#EA3935]" /> Controle de Níveis de Acesso
        </h2>
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
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="social media">Social Media</SelectItem>
                            <SelectItem value="closer">Closer</SelectItem>
                            <SelectItem value="sdr">SDR</SelectItem>
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
    </div>
  );
}
