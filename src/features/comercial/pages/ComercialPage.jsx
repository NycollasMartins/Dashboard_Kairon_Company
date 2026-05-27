import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TrendingUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import { leadsApi } from '@/features/comercial/api/leads.api';
import { queryKeys } from '@/entities/query-keys';
import LeadsKanban from '../components/LeadsKanban';
import LeadNovoModal from '../components/LeadNovoModal';

function LeadStat({ label, value, total = null, accent = 'text-white', dotColor = null }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <div className="flex items-center gap-1.5">
        {dotColor && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
        <span className="text-[10px] uppercase tracking-wider text-white/55 truncate">{label}</span>
        {pct != null && (
          <span className="text-[10px] font-medium text-white/70 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
            {pct}%
          </span>
        )}
      </div>
      <span className={`text-2xl sm:text-3xl font-semibold tracking-tight ${accent}`}>
        {value}
      </span>
    </div>
  );
}

export default function ComercialPage() {
  const { user } = useAuth();
  const podeUsarCrm = ['admin', 'closer', 'sdr', 'bdr'].includes(user?.role);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: leads = [] } = useQuery({
    queryKey: queryKeys.leads.all,
    queryFn: leadsApi.list,
    enabled: podeUsarCrm,
  });

  const criar = useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leads.all });
      setShowForm(false);
      toast({ title: 'Lead adicionado!' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível criar o lead',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  if (!podeUsarCrm) {
    return (
      <div className="glass-card border border-white/5 rounded-2xl p-10 flex flex-col items-center gap-3 text-center animate-fade-in">
        <div className="w-12 h-12 rounded-xl bg-[#EA3935]/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-[#EA3935]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Acesso restrito</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Apenas usuários com perfil <b>admin</b>, <b>head</b>, <b>closer</b>, <b>sdr</b> ou <b>bdr</b> podem acessar o CRM.
          </p>
        </div>
      </div>
    );
  }

  const totals = leads.reduce(
    (acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-5 animate-fade-in">
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
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="px-6 mt-4">
          <h1 className="text-[1.7rem] font-bold text-white tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Acompanhe o funil comercial: do primeiro contato à reunião marcada.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#EA3935] hover:bg-[#C12D29] text-white border-0 text-sm h-9 font-semibold"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Novo Lead
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 sm:gap-6 glass-card rounded-2xl border border-white/10 p-5 sm:p-6">
        <LeadStat label="No funil" value={leads.length} />
        <LeadStat
          label="Pendentes"
          value={totals.pendente || 0}
          total={leads.length}
          accent="text-slate-200"
          dotColor="bg-slate-400"
        />
        <LeadStat
          label="Em atendimento"
          value={totals.em_atendimento || 0}
          total={leads.length}
          accent="text-blue-200"
          dotColor="bg-blue-400"
        />
        <LeadStat
          label="Follow up"
          value={totals.follow_up || 0}
          total={leads.length}
          accent="text-amber-200"
          dotColor="bg-amber-400"
        />
        <LeadStat
          label="Reunião"
          value={totals.reuniao_marcada || 0}
          total={leads.length}
          accent="text-emerald-200"
          dotColor="bg-emerald-400"
        />
      </div>

      <LeadsKanban />

      {showForm && (
        <LeadNovoModal
          isSubmitting={criar.isPending}
          onClose={() => setShowForm(false)}
          onSave={(data) => criar.mutate(data)}
        />
      )}
    </div>
  );
}
