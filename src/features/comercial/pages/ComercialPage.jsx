import { useQuery } from '@tanstack/react-query';
import { Target } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { leadsApi } from '@/features/comercial/api/leads.api';
import { queryKeys } from '@/entities/query-keys';
import LeadsKanban from '../components/LeadsKanban';

export default function ComercialPage() {
  const { user } = useAuth();
  const isAdminOrCloser = user?.role === 'admin' || user?.role === 'closer';

  const { data: leads = [] } = useQuery({
    queryKey: queryKeys.leads.all,
    queryFn: leadsApi.list,
    enabled: isAdminOrCloser,
  });

  if (!isAdminOrCloser) {
    return (
      <div className="glass-card border border-white/5 rounded-2xl p-10 flex flex-col items-center gap-3 text-center animate-fade-in">
        <div className="w-12 h-12 rounded-xl bg-[#EA3935]/10 flex items-center justify-center">
          <Target className="w-5 h-5 text-[#EA3935]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Acesso restrito</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Apenas usuários com perfil <b>admin</b> ou <b>closer</b> podem acessar o CRM.
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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
            {totals.follow_up || 0} em follow up
            {' · '}
            {totals.reuniao_marcada || 0} com reunião
          </p>
        </div>
      </div>

      <LeadsKanban />
    </div>
  );
}
