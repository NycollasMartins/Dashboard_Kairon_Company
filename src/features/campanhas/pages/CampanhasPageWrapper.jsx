import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';
import CampanhasPage from '@/features/campanhas/pages/CampanhasPage';
import CampanhaDetalhePage from '@/features/campanhas/pages/CampanhaDetalhePage';

const CAMPANHAS_ROLES = ['admin'];

function CampanhasListaRoute() {
  const navigate = useNavigate();
  return <CampanhasPage onVerCampanha={(id) => navigate(`/campanhas/${id}`)} />;
}

function CampanhaDetalheRoute() {
  const navigate = useNavigate();
  const { campanhaId } = useParams();
  return (
    <CampanhaDetalhePage
      campanhaId={campanhaId}
      onBack={() => navigate('/campanhas')}
    />
  );
}

export default function CampanhasPageWrapper() {
  const { user } = useAuth();

  if (!CAMPANHAS_ROLES.includes(user?.role)) {
    return (
      <RestrictedAccessCard
        description="Apenas administradores podem acessar Campanhas."
      />
    );
  }

  return (
    <Routes>
      <Route index element={<CampanhasListaRoute />} />
      <Route path=":campanhaId" element={<CampanhaDetalheRoute />} />
    </Routes>
  );
}
