import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Edit2, Archive, Mail, FileText, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import ClienteForm from '@/features/clientes/components/ClienteForm';
import ProjetosLista from '@/features/projetos/components/ProjetosLista';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { queryKeys } from '@/entities/query-keys';

const statusConfig = {
  ativo: { label: 'Ativo', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
  churn: { label: 'Churn', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-400' },
};

function formatMesAno(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const mes = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const ano = d.getFullYear();
    return `${mes.charAt(0).toUpperCase() + mes.slice(1)} ${ano}`;
  } catch {
    return '—';
  }
}

function TabContrato({ sectionIndex = 3 }) {
  const sectionNumber = String(sectionIndex).padStart(2, '0');
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-0.5 h-5 rounded-full bg-[#EA3935]" />
          <span className="text-xs font-mono text-muted-foreground tracking-wider">{sectionNumber}</span>
        </div>
        <h2 className="text-lg font-semibold text-white">Contrato do Cliente</h2>
      </div>
      <div className="glass-card rounded-2xl border border-white/5 p-10 flex flex-col items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
          <FileText className="w-7 h-7 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-white">Nenhum contrato cadastrado</p>
        <p className="text-xs text-muted-foreground text-center">As informações de contrato deste cliente aparecerão aqui.</p>
      </div>
    </div>
  );
}

export default function ClienteDetalhePage({ clienteId, onBack, onVerProjeto }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showConfirmArchive, setShowConfirmArchive] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: cliente, isLoading } = useQuery({
    queryKey: queryKeys.clientes.detail(clienteId),
    queryFn: () => clientesApi.get(clienteId),
    enabled: !!clienteId,
  });

  const atualizar = useMutation({
    mutationFn: (data) => clientesApi.update(clienteId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clientes.detail(clienteId) });
      qc.invalidateQueries({ queryKey: queryKeys.clientes.all });
      setShowEdit(false);
      toast({ title: 'Cliente atualizado!' });
    },
  });

  const arquivar = useMutation({
    mutationFn: () => clientesApi.archive(clienteId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.clientes.detail(clienteId) });
      qc.invalidateQueries({ queryKey: queryKeys.clientes.all });
      qc.invalidateQueries({ queryKey: queryKeys.tarefas.all });
      setShowConfirmArchive(false);
      toast({ title: 'Cliente marcado como churn.' });
      onBack();
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível marcar como churn',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#EA3935]/30 border-t-[#EA3935] rounded-full animate-spin" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-sm">Cliente não encontrado.</p>
        <Button onClick={onBack} variant="outline" className="mt-4 border-white/10 text-muted-foreground">
          Voltar
        </Button>
      </div>
    );
  }

  const cfg = statusConfig[cliente.status] || statusConfig.ativo;
  const tier = cliente.tier ?? null;
  const cnpj = cliente.cnpj ?? null;
  const cidade = cliente.cidade ?? null;
  const uf = cliente.uf ?? null;
  const localizacao = [cidade, uf].filter(Boolean).join(', ');
  const clienteDesde = formatMesAno(cliente.created_at);
  const squad = cliente.squads;

  return (
    <div className="space-y-16 animate-fade-in">
      <div>
        <div className="relative h-36 w-full rounded-2xl overflow-hidden bg-gradient-to-br from-[#EA3935]/30 via-purple-500/15 to-blue-500/25">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(234,57,53,0.25),transparent_55%)]" />
          <div className="absolute inset-0 flex items-start justify-between p-4">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-black/30 hover:bg-black/50 border border-white/10 text-white/80 hover:text-white backdrop-blur transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setShowEdit(true)}
                variant="outline"
                className="border-white/15 bg-black/30 backdrop-blur text-white hover:bg-black/50 hover:text-white h-9 px-4 text-xs gap-2"
              >
                <Edit2 className="w-3.5 h-3.5" /> Editar
              </Button>
              {cliente.status !== 'churn' && (
                <Button
                  onClick={() => setShowConfirmArchive(true)}
                  className="bg-[#EA3935]/20 hover:bg-[#EA3935]/35 border border-[#EA3935]/40 text-white backdrop-blur h-9 px-4 text-xs gap-2"
                >
                  <Archive className="w-3.5 h-3.5" /> Marcar churn
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 pb-2">
          <div className="-mt-12 mb-5 flex items-end gap-4">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-4xl shrink-0 ring-4 ring-background shadow-xl"
              style={{ background: 'linear-gradient(135deg, #EA3935, #B91C1C)' }}
            >
              {cliente.nome?.[0]?.toUpperCase() || '?'}
            </div>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-bold text-white truncate">{cliente.nome}</h2>
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.bg} ${cfg.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </span>
                {tier && (
                  <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 font-medium">
                    Tier {tier}
                  </span>
                )}
              </div>
              {cliente.email && (
                <a
                  href={`mailto:${cliente.email}`}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#EA3935] transition-colors"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {cliente.email}
                </a>
              )}

              <div className="space-y-1.5 pt-2 text-sm">
                <div className="flex flex-wrap gap-x-8 gap-y-1">
                  <span>
                    <span className="text-muted-foreground">CNPJ </span>
                    <span className="text-white font-medium">{cnpj || '—'}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Empresa </span>
                    <span className="text-white font-medium">{cliente.empresa || '—'}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-1">
                  <span>
                    <span className="text-muted-foreground">Localização </span>
                    <span className="text-white font-medium">{localizacao || '—'}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Telefone </span>
                    <span className="text-white font-medium">{cliente.telefone || '—'}</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-1">
                  <span>
                    <span className="text-muted-foreground">Cliente desde </span>
                    <span className="text-white font-medium">{clienteDesde}</span>
                  </span>
                </div>
              </div>

              {cliente.notas && (
                <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-white/10 pl-3 italic mt-3">
                  {cliente.notas}
                </p>
              )}
            </div>

            {squad && (
              <div className="flex items-center gap-2.5 pt-1">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium">Squad</p>
                  <p className="text-xs font-medium text-muted-foreground truncate">{squad.nome}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="h-px bg-white/5" />

      <div className="space-y-10">
        <ProjetosLista clienteId={clienteId} sectionIndex={1} onVerProjeto={onVerProjeto} />
        <TabContrato sectionIndex={2} />
      </div>

      {showEdit && (
        <ClienteForm
          cliente={cliente}
          onClose={() => setShowEdit(false)}
          onSave={(form) => atualizar.mutate(form)}
        />
      )}
      {showConfirmArchive && (
        <ConfirmArchiveDialog
          title={`Marcar ${cliente.nome} como churn?`}
          description="O cliente sai da carteira ativa e suas tarefas somem do Kanban. O histórico é preservado e você pode reativar a qualquer momento mudando o status para Ativo."
          confirmLabel="Marcar churn"
          onConfirm={() => arquivar.mutate()}
          onCancel={() => setShowConfirmArchive(false)}
          isLoading={arquivar.isPending}
        />
      )}
    </div>
  );
}
