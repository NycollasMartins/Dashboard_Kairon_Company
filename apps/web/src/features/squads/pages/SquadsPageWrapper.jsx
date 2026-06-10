import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';
import SquadsPage from '@/features/squads/pages/SquadsPage';
import SquadDetalhePage from '@/features/squads/pages/SquadDetalhePage';

function SquadsListaRoute({ apenasMeus }) {
  const navigate = useNavigate();
  // Filmmaker vê só os squads que participa, em leitura (sem abrir o detalhe).
  return <SquadsPage apenasMeus={apenasMeus} onVerSquad={apenasMeus ? undefined : (id) => navigate(`/squads/${id}`)} />;
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
  const role = user?.role;
  const isFilmmaker = role === 'Filmmaker';

  // Admin/head/dev gerenciam; Filmmaker tem acesso de leitura só aos seus squads.
  if (!['admin', 'head', 'dev', 'Filmmaker'].includes(role)) {
    return (
      <RestrictedAccessCard
        description="Apenas usuários com perfil admin, head ou dev podem gerenciar Squads."
      />
    );
  }

  return (
    <Routes>
      <Route index element={<SquadsListaRoute apenasMeus={isFilmmaker} />} />
      {/* Filmmaker não acessa o detalhe (que tem dados financeiros/clientes). */}
      <Route path=":squadId" element={isFilmmaker ? <Navigate to="/squads" replace /> : <SquadDetalheRoute />} />
    </Routes>
  );
}
