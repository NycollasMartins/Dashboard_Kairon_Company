import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Edit2, Archive, Mail, Phone, Building2,
  Users, Package, FileText, Upload, FolderOpen, User,
  FileBadge, MapPin, CalendarDays, UserCheck, TrendingUp,
  Briefcase,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import ConfirmArchiveDialog from '@/shared/ui/ConfirmArchiveDialog';
import ClienteForm from '@/features/clientes/components/ClienteForm';
import ProjetosLista from '@/features/projetos/components/ProjetosLista';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { queryKeys } from '@/entities/query-keys';

const statusConfig = {
  lead: { label: 'Lead', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-400' },
  qualificado: { label: 'Qualificado', color: 'text-[#EA3935]', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-[#EA3935]' },
  ativo: { label: 'Ativo', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
  inativo: { label: 'Inativo', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-400' },
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

function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor || 0);
}

function StatCard({ label, value, footer, accent }) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 p-5 space-y-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
        {label}
      </p>
      <p className="text-2xl font-bold text-white font-mono tracking-tight">
        {value}
      </p>
      {footer && (
        <div className={`text-[11px] flex items-center gap-1.5 ${accent || 'text-muted-foreground'}`}>
          {footer}
        </div>
      )}
    </div>
  );
}

const tabs = [
  { id: 'dados', label: 'Dados Gerais' },
  { id: 'projetos', label: 'Projetos' },
  { id: 'equipe', label: 'Equipe Responsável' },
  { id: 'arquivos', label: 'Arquivos' },
];

function TabDadosGerais({ cliente }) {
  const squad = cliente.squads;
  const responsavel = cliente.responsavel;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl border border-white/5 p-5 space-y-3">
          <p className="text-xs font-semibold text-[#EA3935] uppercase tracking-wider flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Contato
          </p>
          {cliente.email ? (
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <a href={`mailto:${cliente.email}`} className="text-sm text-white hover:text-[#EA3935] transition-colors truncate">
                {cliente.email}
              </a>
            </div>
          ) : <p className="text-xs text-muted-foreground italic">Sem email</p>}
          {cliente.telefone ? (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <a href={`tel:${cliente.telefone}`} className="text-sm text-white hover:text-[#EA3935] transition-colors">
                {cliente.telefone}
              </a>
            </div>
          ) : <p className="text-xs text-muted-foreground italic">Sem telefone</p>}
          {cliente.empresa && (
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-white">{cliente.empresa}</span>
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl border border-white/5 p-5 space-y-3">
          <p className="text-xs font-semibold text-[#EA3935] uppercase tracking-wider flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Squad & Responsável
          </p>
          {squad ? (
            <div>
              <p className="text-sm font-medium text-white">{squad.nome}</p>
              {squad.descricao && <p className="text-xs text-muted-foreground mt-0.5">{squad.descricao}</p>}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Nenhum squad atribuído</p>
          )}
          {responsavel && (
            <div className="flex items-center gap-2 pt-1 border-t border-white/5">
              <div className="w-6 h-6 rounded-lg bg-[#EA3935]/20 flex items-center justify-center text-[#EA3935] text-xs font-semibold shrink-0">
                {responsavel.full_name?.[0]?.toUpperCase() || <User className="w-3 h-3" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{responsavel.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{responsavel.email}</p>
              </div>
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl border border-white/5 p-5 space-y-3">
          <p className="text-xs font-semibold text-[#EA3935] uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Notas
          </p>
          {cliente.notas ? (
            <p className="text-sm text-muted-foreground leading-relaxed">{cliente.notas}</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Sem notas</p>
          )}
        </div>
      </div>

      {cliente.entregaveis?.length > 0 && (
        <div className="glass-card rounded-2xl border border-white/5 p-5">
          <p className="text-xs font-semibold text-[#EA3935] uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <Package className="w-3.5 h-3.5" /> Entregáveis
          </p>
          <div className="flex flex-wrap gap-2">
            {cliente.entregaveis.map((e) => (
              <span key={e} className="px-3 py-1 rounded-lg bg-[#EA3935]/10 border border-[#EA3935]/20 text-xs text-white">
                {e}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabEquipe({ cliente }) {
  const squad = cliente.squads;
  const membros = squad?.squad_membros?.map((sm) => sm.profiles).filter(Boolean) ?? [];

  return (
    <div className="glass-card rounded-2xl border border-white/5 p-5">
      <p className="text-xs font-semibold text-[#EA3935] uppercase tracking-wider flex items-center gap-1.5 mb-4">
        <Users className="w-3.5 h-3.5" /> Equipe Responsável
        {squad && <span className="text-muted-foreground font-normal normal-case">— {squad.nome}</span>}
      </p>
      {membros.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {membros.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-semibold shrink-0"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}
              >
                {u.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{u.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Nenhum membro na equipe responsável.</p>
      )}
    </div>
  );
}

function TabArquivos() {
  return (
    <div className="glass-card rounded-2xl border border-white/5 p-10 flex flex-col items-center justify-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
        <FolderOpen className="w-7 h-7 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-white">Nenhum arquivo enviado</p>
      <p className="text-xs text-muted-foreground text-center">Funcionalidade de upload de arquivos em breve.</p>
      <Button variant="outline" className="border-white/10 text-muted-foreground hover:text-white mt-2 gap-2">
        <Upload className="w-4 h-4" /> Enviar Arquivo
      </Button>
    </div>
  );
}

export default function ClienteDetalhePage({ clienteId, onBack }) {
  const [activeTab, setActiveTab] = useState('dados');
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
      toast({ title: 'Cliente arquivado.' });
      onBack();
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível arquivar o cliente',
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

  const cfg = statusConfig[cliente.status] || statusConfig.lead;
  const squadMembros = cliente.squads?.squad_membros ?? [];
  const tier = cliente.tier ?? null;
  const cnpj = cliente.cnpj ?? null;
  const cidade = cliente.cidade ?? null;
  const uf = cliente.uf ?? null;
  const localizacao = [cidade, uf].filter(Boolean).join(', ');
  const clienteDesde = formatMesAno(cliente.created_at);

  const mrr = cliente.mrr ?? 0;
  const mrrDelta = cliente.mrr_delta ?? 0;
  const contratoTotal = cliente.contrato_total ?? 0;
  const contratoMeses = cliente.contrato_meses ?? 0;
  const projetosAtivos = cliente.projetos_ativos ?? 0;
  const projetosEmDev = cliente.projetos_em_dev ?? 0;
  const renovacaoDias = cliente.renovacao_dias ?? 0;
  const renovacaoData = cliente.renovacao_data ?? null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-muted-foreground hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowEdit(true)}
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white h-10 px-4 text-sm gap-2"
          >
            <Edit2 className="w-4 h-4" /> Editar
          </Button>
          {cliente.status !== 'inativo' && (
            <Button
              onClick={() => setShowConfirmArchive(true)}
              className="bg-[#EA3935]/15 hover:bg-[#EA3935]/25 border border-[#EA3935]/30 text-[#EA3935] h-10 px-4 text-sm gap-2"
            >
              <Archive className="w-4 h-4" /> Deletar
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex items-start gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-[#EA3935] font-bold text-3xl shrink-0 border border-[#EA3935]/20"
            style={{ background: 'rgba(234, 57, 53, 0.18)' }}
          >
            {cliente.nome?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0 space-y-3">
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
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileBadge className="w-4 h-4" />
                <span>CNPJ</span>
                <span className="text-white font-medium">{cnpj || '—'}</span>
              </div>
              {localizacao && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span className="text-white font-medium">{localizacao}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                <span>Cliente desde</span>
                <span className="text-white font-medium">{clienteDesde}</span>
              </div>
            </div>
            {cliente.responsavel && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCheck className="w-4 h-4" />
                <span>Conta gerenciada por</span>
                <span className="text-white font-medium">{cliente.responsavel.full_name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-1 rounded-2xl border border-white/5 bg-white/[0.02]">
          <StatCard
            label="MRR"
            value={formatBRL(mrr)}
            accent={mrrDelta > 0 ? 'text-emerald-400' : mrrDelta < 0 ? 'text-red-400' : 'text-muted-foreground'}
            footer={
              <>
                {mrrDelta !== 0 && <TrendingUp className="w-3 h-3" />}
                {mrrDelta > 0 ? `+${mrrDelta}% vs. mês anterior` : mrrDelta < 0 ? `${mrrDelta}% vs. mês anterior` : 'Sem variação'}
              </>
            }
          />
          <StatCard
            label="Contrato Total"
            value={formatBRL(contratoTotal)}
            accent={null}
            footer={<>Período {contratoMeses || 0} meses</>}
          />
          <StatCard
            label="Projetos Ativos"
            value={String(projetosAtivos).padStart(2, '0')}
            accent={null}
            footer={
              <>
                <Briefcase className="w-3 h-3" />
                {projetosEmDev} em desenvolvimento
              </>
            }
          />
          <StatCard
            label="Renovação em"
            value={
              <>
                {renovacaoDias} <span className="text-base font-normal text-muted-foreground">dias</span>
              </>
            }
            accent="text-amber-300"
            footer={
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                {renovacaoData ? `${renovacaoData} — renovação automática` : 'Renovação automática'}
              </>
            }
          />
        </div>
      </div>

      <div className="flex gap-1 p-1 glass-card rounded-xl border border-white/5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap
              ${activeTab === tab.id ? 'bg-[#EA3935] text-white shadow' : 'text-muted-foreground hover:text-white'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {activeTab === 'dados' && <TabDadosGerais cliente={cliente} />}
        {activeTab === 'projetos' && (
          <ProjetosLista clienteId={clienteId} clienteNome={cliente.nome} squadMembros={squadMembros} />
        )}
        {activeTab === 'equipe' && <TabEquipe cliente={cliente} />}
        {activeTab === 'arquivos' && <TabArquivos />}
      </motion.div>

      {showEdit && (
        <ClienteForm
          cliente={cliente}
          onClose={() => setShowEdit(false)}
          onSave={(form) => atualizar.mutate(form)}
        />
      )}
      {showConfirmArchive && (
        <ConfirmArchiveDialog
          title={`Arquivar ${cliente.nome}?`}
          description="O cliente fica oculto da lista e suas tarefas somem do Kanban. O histórico é preservado e você pode reativar a qualquer momento mudando o status para Ativo."
          onConfirm={() => arquivar.mutate()}
          onCancel={() => setShowConfirmArchive(false)}
          isLoading={arquivar.isPending}
        />
      )}
    </div>
  );
}
