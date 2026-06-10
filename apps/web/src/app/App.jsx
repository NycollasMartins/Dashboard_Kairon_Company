import { Toaster } from '@/components/ui/toaster';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/context/AuthContext';
import { NotificationsProvider } from '@/features/notifications/NotificationsContext';
import { queryClientInstance } from '@/shared/lib/query-client';
import ProtectedRoute from '@/shared/components/ProtectedRoute';
import LoginPage from '@/features/auth/pages/LoginPage';
import AcceptInvitePage from '@/features/auth/pages/AcceptInvitePage';
import DashboardLayout from '@/features/dashboard/pages/DashboardLayout';
import VisaoGeralPage from '@/features/dashboard/pages/VisaoGeralPage';
import CalendarioPageWrapper from '@/features/calendario/pages/CalendarioPageWrapper';
import MetasPage from '@/features/metas/pages/MetasPage';
import FinanceiroPage from '@/features/financeiro/pages/FinanceiroPage';
import RelatoriosPage from '@/features/relatorios/pages/RelatoriosPage';
import AdministrativoPage from '@/features/administrativo/pages/AdministrativoPage';
import ClientesPageWrapper from '@/features/clientes/pages/ClientesPageWrapper';
import MinhasTarefasPage from '@/features/tarefas/pages/MinhasTarefasPage';
import SquadsPageWrapper from '@/features/squads/pages/SquadsPageWrapper';
import ComercialPage from '@/features/comercial/pages/ComercialPage';
import CampanhasPageWrapper from '@/features/campanhas/pages/CampanhasPageWrapper';
import PageNotFound from '@/shared/components/PageNotFound';

function AppContent() {
  const { isLoadingAuth, isAuthenticated, user } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  // Papel "TV": acesso somente à aba Metas (leitura). Qualquer outra rota
  // redireciona para /metas.
  const isTv = user?.role === 'tv';
  // Papel "Filmmaker": apenas Visão Geral, Calendário, Tarefas e Squads (os que
  // participa). Demais rotas redirecionam para a Visão Geral.
  const isFilmmaker = user?.role === 'Filmmaker';

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={isTv ? '/metas' : '/'} replace /> : <LoginPage />}
      />
      <Route path="/aceitar-convite" element={<AcceptInvitePage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          {isTv ? (
            <>
              <Route path="metas" element={<MetasPage />} />
              <Route path="*" element={<Navigate to="/metas" replace />} />
            </>
          ) : isFilmmaker ? (
            <>
              <Route index element={<VisaoGeralPage />} />
              <Route path="calendario" element={<CalendarioPageWrapper />} />
              <Route path="tarefas" element={<MinhasTarefasPage />} />
              <Route path="squads/*" element={<SquadsPageWrapper />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route index element={<VisaoGeralPage />} />
              <Route path="calendario" element={<CalendarioPageWrapper />} />
              <Route path="metas" element={<MetasPage />} />
              <Route path="administrativo" element={<AdministrativoPage />} />
              <Route path="financeiro" element={<FinanceiroPage />} />
              <Route path="relatorios" element={<RelatoriosPage />} />
              <Route path="clientes/*" element={<ClientesPageWrapper />} />
              <Route path="tarefas" element={<MinhasTarefasPage />} />
              <Route path="squads/*" element={<SquadsPageWrapper />} />
              <Route path="comercial" element={<ComercialPage />} />
              <Route path="campanhas/*" element={<CampanhasPageWrapper />} />
            </>
          )}
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <NotificationsProvider>
            <AppContent />
            <Toaster />
          </NotificationsProvider>
        </QueryClientProvider>
      </AuthProvider>
    </Router>
  );
}
