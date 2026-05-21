import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import { leadsApi } from '@/features/comercial/api/leads.api';
import { queryKeys } from '@/entities/query-keys';
import LeadsKanban from '../components/LeadsKanban';
import LeadNovoModal from '../components/LeadNovoModal';

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
          <Target className="w-5 h-5 text-[#EA3935]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Acesso restrito</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Apenas usuários com perfil <b>admin</b>, <b>closer</b>, <b>sdr</b> ou <b>bdr</b> podem acessar o CRM.
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 mb-1">
            <Target className="w-3 h-3" />
            <span>Comercial</span>
            <span className="opacity-40">·</span>
            <span>CRM</span>
          </div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Leads</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {leads.length} lead{leads.length === 1 ? '' : 's'} no funil
            {' · '}
            {totals.pendente || 0} pendente{(totals.pendente || 0) === 1 ? '' : 's'}
            {' · '}
            {totals.em_atendimento || 0} em atendimento
            {' · '}
            {totals.follow_up || 0} em follow up
            {' · '}
            {totals.reuniao_marcada || 0} com reunião
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          className="bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white text-sm h-9 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" /> Novo Lead
        </Button>
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
