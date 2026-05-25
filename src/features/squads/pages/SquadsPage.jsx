import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Plus, Edit2, Trash2, X, Check, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';
import { squadsApi } from '@/features/squads/api/squads.api';
import { squadMembrosApi } from '@/features/squads/api/squad-membros.api';
import { usersApi } from '@/features/administrativo/api/users.api';
import { queryKeys } from '@/entities/query-keys';

function SquadForm({ squad, usuarios, onClose, onSave }) {
  const [form, setForm] = useState({
    nome: squad?.nome || '',
    descricao: squad?.descricao || '',
    membros_ids: squad?.squad_membros?.map((sm) => sm.profile_id) || [],
  });

  const toggleMembro = (id) => {
    setForm((f) => ({
      ...f,
      membros_ids: f.membros_ids.includes(id)
        ? f.membros_ids.filter((m) => m !== id)
        : [...f.membros_ids, id],
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card border border-white/10 rounded-2xl p-6 w-full max-w-md z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">{squad ? 'Editar Squad' : 'Novo Squad'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <Input
            placeholder="Nome do squad"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
          />
          <Input
            placeholder="Descrição (opcional)"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
          />

          <div>
            <p className="text-xs text-muted-foreground mb-2">Selecionar membros:</p>
            {usuarios.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum usuário cadastrado no sistema.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {usuarios.map((u) => {
                  const selecionado = form.membros_ids.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleMembro(u.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all border
                        ${selecionado
                          ? 'border-[#EA3935]/40 bg-[#EA3935]/10 text-white'
                          : 'border-white/5 bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10'}`}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: selecionado ? 'rgba(234, 57, 53,0.3)' : 'rgba(255,255,255,0.08)' }}
                      >
                        {u.full_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-xs font-medium">{u.full_name || u.email}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      {selecionado && <Check className="w-3.5 h-3.5 text-[#EA3935]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={onClose} variant="outline" className="flex-1 border-white/10 text-muted-foreground hover:text-white">Cancelar</Button>
            <Button
              onClick={() => onSave(form)}
              disabled={!form.nome.trim()}
              className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white"
            >
              <Check className="w-4 h-4 mr-1" /> Salvar
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function SquadsPage() {
  const { user } = useAuth();
  if (user?.role !== 'admin' && user?.role !== 'head') {
    return (
      <RestrictedAccessCard
        description="Apenas usuários com perfil admin ou head podem gerenciar Squads."
      />
    );
  }
  return <SquadsPageContent />;
}

function SquadsPageContent() {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: squads = [] } = useQuery({
    queryKey: queryKeys.squads.all,
    queryFn: squadsApi.list,
  });

  const { data: usuariosRaw = [] } = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: usersApi.list,
  });
  const usuarios = usuariosRaw.filter((u) => u.status === 'active');

  const criar = useMutation({
    mutationFn: async ({ nome, descricao, membros_ids }) => {
      const squad = await squadsApi.create({ nome, descricao });
      if (membros_ids.length > 0) {
        await squadMembrosApi.setMembros(squad.id, membros_ids);
      }
      return squad;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.squads.all });
      setShowForm(false);
      toast({ title: 'Squad criado!' });
    },
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, data: { nome, descricao, membros_ids } }) => {
      const squad = await squadsApi.update(id, { nome, descricao });
      await squadMembrosApi.setMembros(id, membros_ids);
      return squad;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.squads.all });
      setEditando(null);
      toast({ title: 'Squad atualizado!' });
    },
  });

  const deletar = useMutation({
    mutationFn: squadsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.squads.all }); toast({ title: 'Squad removido.' }); },
  });

  const handleSave = (form) => {
    if (editando) atualizar.mutate({ id: editando.id, data: form });
    else criar.mutate(form);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-[#EA3935]" /> Squads
        </h2>
        <Button onClick={() => setShowForm(true)} className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Novo Squad
        </Button>
      </div>

      {squads.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/5 p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm mb-4">Nenhum squad criado ainda.</p>
          <Button onClick={() => setShowForm(true)} className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm">
            Criar primeiro squad
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {squads.map((squad, i) => {
            const membrosDoSquad = squad.squad_membros?.map((sm) => sm.profiles).filter(Boolean) || [];
            return (
              <motion.div
                key={squad.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card rounded-2xl border border-white/5 p-5 flex flex-col gap-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{squad.nome}</p>
                    {squad.descricao && <p className="text-xs text-muted-foreground mt-0.5">{squad.descricao}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditando(squad)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deletar.mutate(squad.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <UserPlus className="w-3 h-3" /> {membrosDoSquad.length} {membrosDoSquad.length === 1 ? 'membro' : 'membros'}
                  </p>
                  {membrosDoSquad.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Sem membros.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {membrosDoSquad.map((u) => (
                        <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/5">
                          <div
                            className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ background: 'rgba(234, 57, 53,0.25)' }}
                          >
                            {u.full_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span className="text-xs text-muted-foreground">{u.full_name || u.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {(showForm || editando) && (
        <SquadForm
          squad={editando}
          usuarios={usuarios}
          onClose={() => { setShowForm(false); setEditando(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
