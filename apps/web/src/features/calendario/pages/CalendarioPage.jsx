import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addMonths, subMonths, format, isSameMonth, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Link2, Unlink, CheckCircle2,
  CalendarClock, CalendarRange, Users as UsersIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import { queryKeys } from '@/entities/query-keys';
import { calendarioApi } from '@/features/calendario/api/calendario.api';
import { googleCalendarApi } from '@/features/calendario/api/googleCalendar.api';
import { EVENT_TYPE_LIST } from '@/features/calendario/lib/eventConfig';
import CalendarMonthGrid from '@/features/calendario/components/CalendarMonthGrid';
import EventoForm from '@/features/calendario/components/EventoForm';
import EventoDetalhe from '@/features/calendario/components/EventoDetalhe';

function StatCard({ icon: Icon, label, value, accent = 'text-[#EA3935]' }) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 p-6 hover:border-white/10 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-3.5 h-3.5 ${accent}`} />
        <p className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="text-4xl font-semibold text-white tracking-tight leading-none tabular-nums">{value}</p>
    </div>
  );
}

export default function CalendarioPage() {
  const { user } = useAuth();
  const canManage = ['admin', 'head', 'dev'].includes(user?.role);
  const isAdmin = user?.role === 'admin';
  const { toast } = useToast();
  const qc = useQueryClient();

  const [month, setMonth] = useState(() => new Date());
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formDate, setFormDate] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const syncWarnRef = useRef('');

  const { data: events = [] } = useQuery({
    queryKey: queryKeys.calendario.all,
    queryFn: calendarioApi.list,
  });

  const { data: googleStatus } = useQuery({
    queryKey: queryKeys.calendario.googleStatus,
    queryFn: googleCalendarApi.status,
    enabled: canManage,
  });
  const googleConnected = !!googleStatus?.connected;

  // -------- sincronização best-effort com o Google ----------
  async function pushToGoogle(row) {
    if (!googleConnected) return;
    try {
      await googleCalendarApi.push(row);
    } catch (e) {
      syncWarnRef.current = e?.message ?? 'Falha ao sincronizar com o Google.';
    }
  }

  const finishMutation = (msg) => {
    qc.invalidateQueries({ queryKey: queryKeys.calendario.all });
    setShowForm(false);
    setEditando(null);
    setFormDate(null);
    if (syncWarnRef.current) {
      toast({
        variant: 'destructive',
        title: 'Evento salvo, mas o Google falhou',
        description: syncWarnRef.current,
      });
      syncWarnRef.current = '';
    } else {
      toast({ title: msg });
    }
  };

  const criar = useMutation({
    mutationFn: async (payload) => {
      const created = await calendarioApi.create(payload);
      await pushToGoogle(created);
      return created;
    },
    onSuccess: () => finishMutation('Evento criado!'),
    onError: (err) =>
      toast({ variant: 'destructive', title: 'Não foi possível criar o evento', description: err?.message }),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, data, google_event_id }) => {
      const updated = await calendarioApi.update(id, data);
      await pushToGoogle({ ...updated, google_event_id });
      return updated;
    },
    onSuccess: () => finishMutation('Evento atualizado!'),
    onError: (err) =>
      toast({ variant: 'destructive', title: 'Não foi possível atualizar o evento', description: err?.message }),
  });

  const excluir = useMutation({
    mutationFn: async (event) => {
      if (googleConnected && event.google_event_id) {
        try {
          await googleCalendarApi.deleteRemote(event.google_event_id);
        } catch {
          // segue com a exclusão local mesmo se o Google falhar
        }
      }
      await calendarioApi.remove(event.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendario.all });
      setExcluindo(null);
      setDetalhe(null);
      toast({ title: 'Evento excluído.' });
    },
    onError: (err) =>
      toast({ variant: 'destructive', title: 'Não foi possível excluir o evento', description: err?.message }),
  });

  const sincronizar = useMutation({
    mutationFn: googleCalendarApi.pull,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.calendario.all });
      toast({ title: 'Sincronizado com o Google', description: `${res?.imported ?? 0} evento(s) atualizados.` });
    },
    onError: (err) =>
      toast({ variant: 'destructive', title: 'Falha ao sincronizar', description: err?.message }),
  });

  const desconectar = useMutation({
    mutationFn: googleCalendarApi.disconnect,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.calendario.googleStatus });
      toast({ title: 'Google Calendar desconectado', description: 'Clique em "Conectar Google Calendar" para reconectar.' });
    },
    onError: (err) =>
      toast({ variant: 'destructive', title: 'Falha ao desconectar', description: err?.message }),
  });

  const handleSave = (form) => {
    if (editando) {
      atualizar.mutate({ id: editando.id, data: form, google_event_id: editando.google_event_id });
    } else {
      criar.mutate(form);
    }
  };

  const handleConnectGoogle = async () => {
    try {
      const res = await googleCalendarApi.getAuthUrl();
      if (res?.url) {
        window.open(res.url, '_blank', 'noopener');
        toast({
          title: 'Autorize no Google',
          description: 'Conclua a autorização na nova aba e depois clique em Sincronizar.',
        });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Não foi possível conectar', description: err?.message });
    }
  };

  const openNew = (date) => {
    setEditando(null);
    setFormDate(date ?? null);
    setShowForm(true);
  };
  const openEdit = (event) => {
    setDetalhe(null);
    setEditando(event);
    setFormDate(null);
    setShowForm(true);
  };

  const stats = useMemo(() => {
    const noMes = events.filter((e) => isSameMonth(new Date(e.start_at), month)).length;
    const hojeStart = startOfDay(new Date());
    const em7 = endOfDay(addMonths(hojeStart, 0));
    em7.setDate(em7.getDate() + 7);
    const proximos = events.filter((e) => {
      const s = new Date(e.start_at);
      return s >= hojeStart && s <= em7;
    }).length;
    const reunioes = events.filter(
      (e) => e.type === 'meeting' && isSameMonth(new Date(e.start_at), month),
    ).length;
    return { noMes, proximos, reunioes };
  }, [events, month]);

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
            <CalendarDays className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="px-6 mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[1.7rem] font-bold text-white tracking-tight">Calendário</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Acompanhe reuniões, atividades e entregas da equipe. Integrado ao Google Calendar.
            </p>
          </div>

          {canManage && (
            <div className="flex items-center gap-2">
              {googleConnected ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium bg-emerald-500/10 border-emerald-500/20 text-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Google conectado
                  </span>
                  <Button
                    onClick={() => sincronizar.mutate()}
                    disabled={sincronizar.isPending}
                    variant="outline"
                    className="border-white/10 bg-transparent text-white hover:bg-white/5 h-9"
                  >
                    <RefreshCw className={`w-4 h-4 mr-1.5 ${sincronizar.isPending ? 'animate-spin' : ''}`} />
                    Sincronizar
                  </Button>
                  {isAdmin && (
                    <Button
                      onClick={() => desconectar.mutate()}
                      disabled={desconectar.isPending}
                      variant="outline"
                      title="Desconectar para reconectar a conta Google"
                      className="border-white/10 bg-transparent text-muted-foreground hover:text-white hover:bg-white/5 h-9"
                    >
                      <Unlink className="w-4 h-4 mr-1.5" /> Desconectar
                    </Button>
                  )}
                </>
              ) : isAdmin ? (
                <Button
                  onClick={handleConnectGoogle}
                  variant="outline"
                  className="border-white/10 bg-transparent text-white hover:bg-white/5 h-9"
                >
                  <Link2 className="w-4 h-4 mr-1.5" /> Conectar Google Calendar
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Google não conectado</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={CalendarRange} label="Eventos no mês" value={stats.noMes} accent="text-white" />
        <StatCard icon={CalendarClock} label="Próximos 7 dias" value={stats.proximos} accent="text-[#EA3935]" />
        <StatCard icon={UsersIcon} label="Reuniões no mês" value={stats.reunioes} accent="text-blue-300" />
      </div>

      <div className="mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="text-lg font-semibold text-white capitalize min-w-[160px] text-center">
              {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
            </h2>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="p-2 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMonth(new Date())}
              className="ml-1 border-white/10 bg-transparent text-muted-foreground hover:text-white hover:bg-white/5 h-9"
            >
              Hoje
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3">
              {EVENT_TYPE_LIST.map((t) => (
                <span key={t.value} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                  {t.label}
                </span>
              ))}
            </div>
            {canManage && (
              <Button
                onClick={() => openNew(null)}
                className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm h-9"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Novo Evento
              </Button>
            )}
          </div>
        </div>

        <CalendarMonthGrid
          month={month}
          events={events}
          canManage={canManage}
          onDayClick={(day) => openNew(day)}
          onEventClick={(ev) => setDetalhe(ev)}
        />
      </div>

      {showForm && (
        <EventoForm
          event={editando}
          initialDate={formDate}
          isSaving={criar.isPending || atualizar.isPending}
          onClose={() => {
            setShowForm(false);
            setEditando(null);
            setFormDate(null);
          }}
          onSave={handleSave}
        />
      )}

      {detalhe && (
        <EventoDetalhe
          event={detalhe}
          canManage={canManage}
          onClose={() => setDetalhe(null)}
          onEdit={openEdit}
          onDelete={(ev) => setExcluindo(ev)}
        />
      )}

      {excluindo && (
        <ConfirmArchiveDialog
          title={`Excluir "${excluindo.title}"?`}
          description="Esta ação é irreversível. O evento será removido do dashboard e, se sincronizado, também do Google Calendar."
          confirmLabel="Excluir evento"
          loadingLabel="Excluindo..."
          tone="danger"
          onConfirm={() => excluir.mutate(excluindo)}
          onCancel={() => setExcluindo(null)}
          isLoading={excluir.isPending}
        />
      )}
    </div>
  );
}
