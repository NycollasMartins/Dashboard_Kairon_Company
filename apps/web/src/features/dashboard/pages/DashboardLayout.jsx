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
  const podeVerTarefas = ['admin', 'social media', 'editor', 'designer', 'head', 'cs', 'dev'].includes(role);
  const podeUsarClientesSquads = ['admin', 'social media', 'head', 'cs', 'dev'].includes(role);
  const podeUsarCrm = ['admin', 'closer', 'sdr', 'bdr', 'dev'].includes(role);
  const podeUsarSquads = isAdmin || isHead || isCs || isDev;
  const podeVerCampanhas = isAdmin; // Campanhas: somente admin

  return (
    <div className="min-h-screen bg-background font-inter">
      <Sidebar
        isAdmin={isAdmin}
        podeVerTarefas={podeVerTarefas}
        podeUsarClientesSquads={podeUsarClientesSquads}
        podeUsarCrm={podeUsarCrm}
        podeUsarSquads={podeUsarSquads}
        podeVerCampanhas={podeVerCampanhas}
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
