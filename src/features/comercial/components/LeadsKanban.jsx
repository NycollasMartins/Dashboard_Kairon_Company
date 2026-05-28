import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import { supabase } from '@/infrastructure/supabase/client';
import { leadsApi } from '@/features/comercial/api/leads.api';
import { usersApi } from '@/features/administrativo/api/users.api';
import { queryKeys } from '@/entities/query-keys';
import LeadCard from './LeadCard';
import LeadDetalheModal from './LeadDetalheModal';
import ConverterLeadModal from './ConverterLeadModal';

const columns = [
  { id: 'pendente',        label: 'Pendente',         color: 'text-slate-300',   dot: 'bg-slate-400',   border: 'border-slate-500/20',   empty: 'Sem leads pendentes' },
  { id: 'em_atendimento',  label: 'Em Atendimento',   color: 'text-blue-300',    dot: 'bg-blue-400',    border: 'border-blue-500/20',    empty: 'Sem leads em atendimento' },
  { id: 'follow_up',       label: 'Follow Up',        color: 'text-yellow-300',  dot: 'bg-yellow-400',  border: 'border-yellow-500/20',  empty: 'Sem follow ups' },
  { id: 'reuniao_marcada', label: 'Reunião Marcada',  color: 'text-emerald-300', dot: 'bg-emerald-400', border: 'border-emerald-500/20', empty: 'Sem reuniões marcadas' },
];

export default function LeadsKanban() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { toast } = useToast();
  const qc = useQueryClient();
  const [leadAberto, setLeadAberto] = useState(null);
  const [leadParaConverter, setLeadParaConverter] = useState(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: queryKeys.leads.all,
    queryFn: leadsApi.list,
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: queryKeys.usuarios.all,
    queryFn: usersApi.list,
  });

  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => qc.invalidateQueries({ queryKey: queryKeys.leads.all })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const responsaveis = useMemo(
    () =>
      usuarios.filter(
        (u) => (u.role === 'sdr' || u.role === 'bdr') && u.status === 'active',
      ),
    [usuarios]
  );

  const atualizar = useMutation({
    mutationFn: ({ id, data }) => leadsApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.leads.all });
      const prev = qc.getQueryData(queryKeys.leads.all);
      qc.setQueryData(queryKeys.leads.all, (old = []) =>
        old.map((l) => (l.id === id ? { ...l, ...data } : l))
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.leads.all, ctx.prev);
      toast({
        variant: 'destructive',
        title: 'Não foi possível atualizar o lead',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
    onSuccess: (_data, variables) => {
      if (leadAberto && variables?.id === leadAberto.id) {
        setLeadAberto(null);
        toast({ title: 'Lead atualizado.' });
      }
    },
  });

  const marcarPerdido = useMutation({
    mutationFn: (id) => leadsApi.update(id, { status: 'perdido' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leads.all });
      setLeadAberto(null);
      toast({ title: 'Lead marcado como perdido.' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível marcar como perdido',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  const converter = useMutation({
    mutationFn: ({ leadId, extras }) => leadsApi.convertToCliente(leadId, extras),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.clientes.all });
      qc.invalidateQueries({ queryKey: queryKeys.projetos.all });
      setLeadParaConverter(null);
      setLeadAberto(null);
      toast({ title: 'Cliente criado a partir do lead.' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível converter o lead',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  const deletar = useMutation({
    mutationFn: leadsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leads.all });
      setLeadAberto(null);
      toast({ title: 'Lead removido.' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível remover o lead',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  const onDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const lead = leads.find((l) => l.id === draggableId);
    const newStatus = destination.droppableId;
    const payload = { status: newStatus };

    if (newStatus === 'em_atendimento' && !lead?.responsavel_id) {
      if (user?.role === 'sdr' || user?.role === 'bdr') {
        payload.responsavel_id = user.id;
      } else {
        toast({
          variant: 'destructive',
          title: 'Lead sem responsavel',
          description: 'Atribua um SDR ou BDR pelo modal antes de mover para Em Atendimento.',
        });
        return;
      }
    }

    atualizar.mutate({ id: draggableId, data: payload });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Carregando leads...
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((col) => {
            const colLeads = leads.filter(
              (l) => l.status === col.id && !l.cliente_id && l.status !== 'perdido'
            );
            return (
              <div key={col.id} className={`glass-card rounded-2xl border ${col.border} p-3.5 flex flex-col min-h-[300px]`}>
                <div className="flex items-center justify-between mb-3.5 px-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className={`text-xs font-semibold ${col.color}`}>{col.label}</span>
                    <span className="text-[11px] font-medium text-muted-foreground">{colLeads.length}</span>
                  </div>
                </div>
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-xl transition-colors ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                    >
                      {colLeads.length === 0 ? (
                        <div className="h-full min-h-[120px] flex items-center justify-center text-[11px] text-muted-foreground/60 italic">
                          {col.empty}
                        </div>
                      ) : (
                        colLeads.map((lead, i) => (
                          <LeadCard key={lead.id} lead={lead} index={i} onOpen={setLeadAberto} />
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {leadAberto && (
        <LeadDetalheModal
          lead={leadAberto}
          responsaveis={responsaveis}
          isAdmin={isAdmin}
          currentUser={user}
          isSubmitting={atualizar.isPending}
          isMarcandoPerdido={marcarPerdido.isPending}
          onClose={() => setLeadAberto(null)}
          onSave={(data) => atualizar.mutate({ id: leadAberto.id, data })}
          onDelete={(id) => deletar.mutate(id)}
          onMarcarPerdido={(id) => marcarPerdido.mutate(id)}
          onConverter={(lead) => setLeadParaConverter(lead)}
        />
      )}

      {leadParaConverter && (
        <ConverterLeadModal
          lead={leadParaConverter}
          isSubmitting={converter.isPending}
          onClose={() => setLeadParaConverter(null)}
          onConfirm={(extras) =>
            converter.mutate({ leadId: leadParaConverter.id, extras })
          }
        />
      )}
    </>
  );
}
