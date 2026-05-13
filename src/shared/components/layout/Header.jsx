import { useLocation } from 'react-router-dom';
import { Bell, Search, Menu } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';

const routeLabels = {
  '/': 'Visão Geral',
  '/administrativo': 'Administrativo',
  '/clientes': 'Clientes',
  '/tarefas': 'Minhas Tarefas',
  '/squads': 'Squads',
};

export default function Header({ onMenuClick }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const initials = user?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const pageTitle = routeLabels[pathname] || 'Dashboard';

  return (
    <header className="glass-card border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden text-muted-foreground hover:text-white transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-white">{pageTitle}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">Marketing Operations Dashboard</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 glass-card rounded-xl px-3 py-2 border border-white/5">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none w-32"
          />
        </div>

        <button className="relative glass-card rounded-xl p-2.5 border border-white/5 hover:border-purple-500/30 transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-pink-500" />
        </button>

        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-semibold cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)' }}
        >
          {initials}
        </div>
      </div>
    </header>
  );
}
