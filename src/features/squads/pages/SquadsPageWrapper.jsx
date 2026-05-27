import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';
import SquadsPage from '@/features/squads/pages/SquadsPage';
import SquadDetalhePage from '@/features/squads/pages/SquadDetalhePage';

function SquadsListaRoute() {
  const navigate = useNavigate();
  return <SquadsPage onVerSquad={(id) => navigate(`/squads/${id}`)} />;
}

function SquadDetalheRoute() {
  const navigate = useNavigate();
  const { squadId } = useParams();
  return (
    <SquadDetalhePage
      squadId={squadId}
      onBack={() => navigate('/squads')}
      onVerCliente={(clienteId) => navigate(`/clientes/${clienteId}`)}
    />
  );
}

export default function SquadsPageWrapper() {
  const { user } = useAuth();

  if (user?.role !== 'admin' && user?.role !== 'head') {
    return (
      <RestrictedAccessCard
        description="Apenas usuários com perfil admin ou head podem gerenciar Squads."
      />
    );
  }

  return (
    <Routes>
      <Route index element={<SquadsListaRoute />} />
      <Route path=":squadId" element={<SquadDetalheRoute />} />
    </Routes>
  );
}
