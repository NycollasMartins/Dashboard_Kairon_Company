import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Wallet, TrendingUp, BadgeDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/features/auth/context/AuthContext';
import { queryKeys } from '@/entities/query-keys';
import { contratosApi, getContratoAtivo, mrrDoCliente, tcvHistorico, ltvEstimado } from '../api/contratos.api';
import { formatBRL } from '../utils/contrato.format';
import ContratoCard from './ContratoCard';
import ContratoFormModal from './ContratoFormModal';
import CancelarContratoModal from './CancelarContratoModal';
import HistoricoContratos from './HistoricoContratos';

function MiniStat({ icon: Icon, label, value, accent = 'text-[#EA3935]', bgAccent = 'bg-[#EA3935]/10' }) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bgAccent}`}>
          <Icon className={`w-4 h-4 ${accent}`} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="text-base font-semibold text-white tracking-tight truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function ContratosSection({ clienteId, contratos, sectionIndex = 2 }) {
  const sectionNumber = String(sectionIndex).padStart(2, '0');
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const canManage = user?.role === 'admin' || user?.role === 'head' || user?.role === 'cs';

  const [modalCriar, setModalCriar] = useState(false);
  const [modalCancelar, setModalCancelar] = useState(false);

  const ativo = useMemo(() => getContratoAtivo(contratos), [contratos]);
  const mrrAtual = useMemo(() => mrrDoCliente(contratos), [contratos]);
  const tcvTotal = useMemo(() => tcvHistorico(contratos), [contratos]);
  const ltv = useMemo(() => ltvEstimado(contratos), [contratos]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.clientes.detail(clienteId) });
    qc.invalidateQueries({ queryKey: queryKeys.clientes.all });
  };

  const criar = useMutation({
    mutationFn: (payload) => contratosApi.criar({ cliente_id: clienteId, ...payload }),
    onSuccess: () => {
      invalidate();
      setModalCriar(false);
      toast({ title: 'Contrato criado.' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível criar o contrato',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  const cancelar = useMutation({
    mutationFn: ({ motivo, total_recebido }) =>
      contratosApi.cancelar({ contrato_id: ativo?.id, motivo, total_recebido }),
    onSuccess: () => {
      invalidate();
      setModalCancelar(false);
      toast({ title: 'Contrato cancelado.' });
    },
    onError: (err) => {
      toast({
        variant: 'destructive',
        title: 'Não foi possível cancelar o contrato',
        description: err?.message ?? 'Tente novamente em instantes.',
      });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-0.5 h-5 rounded-full bg-[#EA3935]" />
          <span className="text-xs font-mono text-muted-foreground tracking-wider">{sectionNumber}</span>
        </div>
        <h2 className="text-lg font-semibold text-white">Contratos</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniStat
          icon={Wallet}
          label="MRR atual"
          value={`${formatBRL(mrrAtual)}/mês`}
          accent="text-emerald-300"
          bgAccent="bg-emerald-500/10"
        />
        <MiniStat
          icon={BadgeDollarSign}
          label="TCV total fechado"
          value={formatBRL(tcvTotal)}
          accent="text-blue-300"
          bgAccent="bg-blue-500/10"
        />
        <MiniStat
          icon={TrendingUp}
          label="LTV estimado"
          value={formatBRL(ltv)}
          accent="text-[#EA3935]"
          bgAccent="bg-[#EA3935]/10"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Contrato ativo</h3>
          {ativo && canManage && (
            <span className="text-[11px] text-muted-foreground">
              Cancele o atual para criar um novo.
            </span>
          )}
        </div>

        {ativo ? (
          <ContratoCard
            contrato={ativo}
            canManage={canManage}
            onCancelar={() => setModalCancelar(true)}
          />
        ) : (
          <div className="glass-card rounded-2xl border border-white/5 p-10 flex flex-col items-center justify-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
              <FileText className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-white">Nenhum contrato ativo</p>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              {canManage
                ? 'Cadastre o contrato deste cliente para que ele passe a contar nas métricas financeiras.'
                : 'Quando um admin ou head cadastrar o contrato, ele aparecerá aqui.'}
            </p>
            {canManage && (
              <Button
                onClick={() => setModalCriar(true)}
                className="mt-2 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-9 px-4 text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Criar contrato
              </Button>
            )}
          </div>
        )}
      </div>

      <HistoricoContratos contratos={contratos} />

      {modalCriar && (
        <ContratoFormModal
          isSubmitting={criar.isPending}
          onClose={() => setModalCriar(false)}
          onConfirm={(payload) => criar.mutate(payload)}
        />
      )}

      {modalCancelar && ativo && (
        <CancelarContratoModal
          contrato={ativo}
          isSubmitting={cancelar.isPending}
          onClose={() => setModalCancelar(false)}
          onConfirm={(payload) => cancelar.mutate(payload)}
        />
      )}
    </div>
  );
}
