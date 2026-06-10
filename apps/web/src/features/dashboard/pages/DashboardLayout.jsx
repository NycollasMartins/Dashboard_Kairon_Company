import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import Sidebar from '@/shared/components/layout/Sidebar';
import Header from '@/shared/components/layout/Header';

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.role;
  const isAdmin = role === 'admin';
  const isHead = role === 'head';
  const isCs = role === 'cs';
  const isDev = role === 'dev';
  const isTv = role === 'tv'; // TV: somente a aba Metas, apenas leitura
  // Filmaker: Visão Geral, Calendário, Tarefas e Squads (só os que participa).
  const isFilmaker = role === 'filmaker';
  const podeVerTarefas = !isTv && ['admin', 'social media', 'editor', 'designer', 'head', 'cs', 'dev', 'filmaker'].includes(role);
  const podeUsarClientesSquads = !isTv && ['admin', 'social media', 'head', 'cs', 'dev'].includes(role);
  const podeUsarCrm = !isTv && ['admin', 'closer', 'sdr', 'bdr', 'dev'].includes(role);
  const podeUsarSquads = !isTv && (isAdmin || isHead || isCs || isDev || isFilmaker);
  const podeVerCampanhas = isAdmin; // Campanhas: somente admin
  const podeVerMetas = !isTv && !isFilmaker; // Metas: todos menos filmaker (TV tem rota própria)

  return (
    <div className="min-h-screen bg-background font-inter">
      <Sidebar
        isAdmin={isAdmin}
        isTv={isTv}
        podeVerTarefas={podeVerTarefas}
        podeUsarClientesSquads={podeUsarClientesSquads}
        podeUsarCrm={podeUsarCrm}
        podeUsarSquads={podeUsarSquads}
        podeVerCampanhas={podeVerCampanhas}
        podeVerMetas={podeVerMetas}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="md:ml-60 min-h-screen flex flex-col">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
