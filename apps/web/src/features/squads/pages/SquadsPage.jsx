import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Layers, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import SquadForm from '@/features/squads/components/SquadForm';
import SquadCard from '@/features/squads/components/SquadCard';
import { squadsApi } from '@/features/squads/api/squads.api';
import { squadMembrosApi } from '@/features/squads/api/squad-membros.api';
import { usersApi } from '@/features/administrativo/api/users.api';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { mrrDoCliente } from '@/features/clientes/api/contratos.api';
import { queryKeys } from '@/entities/query-keys';

// `apenasMeus`: modo leitura do filmaker — só os squads que ele participa,
// sem gestão e sem dados financeiros (MRR/clientes).
export default function SquadsPage({ onVerSquad, apenasMeus = false }) {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const podeGerenciar = !apenasMeus;

  const { data: squadsRaw = [] } = useQuery({
    queryKey: queryKeys.squads.all,
    queryFn: squadsApi.list,
  });

  const squads = useMemo(() => {
    const ordenados = [...squadsRaw].sort((a, b) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR'));
    if (!apenasMeus) return ordenados;
    return ordenados.filter((s) => (s.squad_membros || []).some((m) => m.profile_id === user?.id));
  }, [squadsRaw, apenasMeus, user?.id]);

  // Dados financeiros/usuários só no modo gestão (filmaker não vê MRR/clientes).
  const { data: clientes = [] } = useQuery({
    queryKey: queryKeys.clientes.all,
    queryFn: clientesApi.list,
    enabled: podeGerenciar,
  });

  const { data: usuariosRaw = [] } = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: usersApi.list,
    enabled: podeGerenciar,
  });
  const usuarios = usuariosRaw.filter((u) => u.status === 'active');

  const statsBySquad = useMemo(() => {
    const map = new Map();
    for (const c of clientes) {
      if (!c.squad_id || c.status !== 'ativo') continue;
      const entry = map.get(c.squad_id) ?? { mrrTotal: 0, clientesAtivosCount: 0 };
      entry.clientesAtivosCount += 1;
      entry.mrrTotal += mrrDoCliente(c.contratos);
      map.set(c.squad_id, entry);
    }
    return map;
  }, [clientes]);

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.squads.all });
      toast({ title: 'Squad removido.' });
    },
  });

  const handleSave = (form) => {
    if (editando) atualizar.mutate({ id: editando.id, data: form });
    else criar.mutate(form);
  };

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
            <Layers className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="px-6 mt-4">
          <h1 className="text-[1.7rem] font-bold text-white tracking-tight">Squads</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {podeGerenciar ? 'Crie e gerencie os squads operacionais e seus membros.' : 'Os squads que você participa e seus membros.'}
          </p>
        </div>
      </div>

      {podeGerenciar && (
        <div className="flex items-center justify-end">
          <Button onClick={() => setShowForm(true)} className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Novo Squad
          </Button>
        </div>
      )}

      {squads.length === 0 ? (
        <div className="glass-card rounded-2xl border border-white/5 p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground text-sm mb-4">
            {podeGerenciar ? 'Nenhum squad criado ainda.' : 'Você ainda não faz parte de nenhum squad.'}
          </p>
          {podeGerenciar && (
            <Button onClick={() => setShowForm(true)} className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm">
              Criar primeiro squad
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {squads.map((squad, i) => {
            const membros = squad.squad_membros?.map((sm) => sm.profiles).filter(Boolean) || [];
            const stats = statsBySquad.get(squad.id) ?? { mrrTotal: 0, clientesAtivosCount: 0 };
            return (
              <SquadCard
                key={squad.id}
                squad={squad}
                membros={membros}
                mrrTotal={stats.mrrTotal}
                clientesAtivosCount={stats.clientesAtivosCount}
                index={i}
                podeGerenciar={podeGerenciar}
                ocultarFinanceiro={!podeGerenciar}
                onClick={onVerSquad ? () => onVerSquad(squad.id) : undefined}
                onEdit={podeGerenciar ? () => setEditando(squad) : undefined}
                onDelete={podeGerenciar ? () => deletar.mutate(squad.id) : undefined}
              />
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
