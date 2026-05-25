import { useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';
import ClientesPage from '@/features/clientes/pages/ClientesPage';
import ClienteDetalhePage from '@/features/clientes/pages/ClienteDetalhePage';
import ProjetoKanban from '@/features/projetos/components/ProjetoKanban';

const OPERACIONAL_ROLES = ['admin', 'social media', 'head'];

export default function ClientesPageWrapper() {
  const { user } = useAuth();
  const [clienteDetalheId, setClienteDetalheId] = useState(null);
  const [projetoSelecionado, setProjetoSelecionado] = useState(null);

  if (projetoSelecionado) {
    return (
      <ProjetoKanban
        projeto={projetoSelecionado}
        onBack={() => setProjetoSelecionado(null)}
      />
    );
  }

  if (!OPERACIONAL_ROLES.includes(user?.role)) {
    return (
      <RestrictedAccessCard
        description="Apenas usuários com perfil admin, head ou social media podem acessar Clientes."
      />
    );
  }

  if (clienteDetalheId) {
    return (
      <ClienteDetalhePage
        clienteId={clienteDetalheId}
        onBack={() => setClienteDetalheId(null)}
        onVerProjeto={(projeto) => setProjetoSelecionado(projeto)}
      />
    );
  }

  return <ClientesPage onVerCliente={(id) => setClienteDetalheId(id)} />;
}
