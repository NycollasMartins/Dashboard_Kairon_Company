import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/context/AuthContext';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';
import ClientesPage from '@/features/clientes/pages/ClientesPage';
import ClienteDetalhePage from '@/features/clientes/pages/ClienteDetalhePage';
import ProjetoKanban from '@/features/projetos/components/ProjetoKanban';
import { projetosApi } from '@/features/projetos/api/projetos.api';
import { queryKeys } from '@/entities/query-keys';

const OPERACIONAL_ROLES = ['admin', 'social media', 'head', 'cs'];

function ClientesListaRoute() {
  const navigate = useNavigate();
  return <ClientesPage onVerCliente={(id) => navigate(`/clientes/${id}`)} />;
}

function ClienteDetalheRoute() {
  const navigate = useNavigate();
  const { clienteId } = useParams();
  return (
    <ClienteDetalhePage
      clienteId={clienteId}
      onBack={() => navigate('/clientes')}
      onVerProjeto={(projeto) => navigate(`/clientes/${clienteId}/projetos/${projeto.id}`)}
    />
  );
}

function ProjetoKanbanRoute() {
  const navigate = useNavigate();
  const { clienteId, projetoId } = useParams();

  const { data: projeto, isLoading } = useQuery({
    queryKey: queryKeys.projetos.detail(projetoId),
    queryFn: () => projetosApi.get(projetoId),
    enabled: !!projetoId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#EA3935]/30 border-t-[#EA3935] rounded-full animate-spin" />
      </div>
    );
  }

  if (!projeto) {
    return <Navigate to={`/clientes/${clienteId}`} replace />;
  }

  return (
    <ProjetoKanban
      projeto={projeto}
      onBack={() => navigate(`/clientes/${clienteId}`)}
    />
  );
}

export default function ClientesPageWrapper() {
  const { user } = useAuth();

  if (!OPERACIONAL_ROLES.includes(user?.role)) {
    return (
      <RestrictedAccessCard
        description="Apenas usuários com perfil admin, head, cs ou social media podem acessar Clientes."
      />
    );
  }

  return (
    <Routes>
      <Route index element={<ClientesListaRoute />} />
      <Route path=":clienteId" element={<ClienteDetalheRoute />} />
      <Route path=":clienteId/projetos/:projetoId" element={<ProjetoKanbanRoute />} />
    </Routes>
  );
}
