import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Shield, Briefcase, Users, CheckSquare,
  ChevronDown, X, Layers, LogOut, Target, TrendingUp, Settings, Megaphone, Calendar, DollarSign,
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { usePreferences } from '@/features/settings/PreferencesContext';

const getNavItems = (t, { isAdmin, podeVerTarefas, podeUsarClientesSquads, podeUsarCrm, podeUsarSquads, podeVerCampanhas }) => [
  { to: '/', label: t('nav.visaoGeral'), icon: LayoutDashboard, end: true },
  { to: '/calendario', label: t('nav.calendario'), icon: Calendar },
  ...(podeUsarCrm
    ? [{
        id: 'comercial', label: t('nav.comercial'), icon: Target,
        children: [
          { to: '/comercial', label: t('nav.pipelineLeads'), icon: TrendingUp },
        ],
      }]
    : []),
  ...(podeVerTarefas || podeVerCampanhas
    ? [{
        id: 'operacional', label: t('nav.operacional'), icon: Briefcase,
        children: [
          ...(podeVerCampanhas ? [{ to: '/campanhas', label: t('nav.campanhas'), icon: Megaphone }] : []),
          ...(podeVerTarefas ? [{ to: '/tarefas', label: t('nav.tarefas'), icon: CheckSquare }] : []),
          ...(podeUsarClientesSquads ? [{ to: '/clientes', label: t('nav.clientes'), icon: Users }] : []),
          ...(podeUsarSquads ? [{ to: '/squads', label: t('nav.squads'), icon: Layers }] : []),
        ],
      }]
    : []),
  ...(isAdmin
    ? [{
        id: 'gestao', label: t('nav.gestao'), icon: Settings,
        children: [
          { to: '/administrativo', label: t('nav.membros'), icon: Shield },
          { to: '/financeiro', label: t('nav.financeiro'), icon: DollarSign },
        ],
      }]
    : []),
];

const activeStyle = { background: 'rgba(234, 57, 53,0.15)', borderColor: 'rgba(234, 57, 53,0.3)' };
const activeDot = { background: '#EA3935' };

export default function Sidebar({
  isAdmin = false,
  podeVerTarefas = false,
  podeUsarClientesSquads = false,
  podeUsarCrm = false,
  podeUsarSquads = false,
  podeVerCampanhas = false,
  mobileOpen,
  setMobileOpen,
}) {
  const { t } = usePreferences();
  const [openGroups, setOpenGroups] = useState({ comercial: true, operacional: true, gestao: true });
  const toggleGroup = (id) =>
    setOpenGroups((s) => ({ ...s, [id]: !s[id] }));
  const navItems = getNavItems(t, { isAdmin, podeVerTarefas, podeUsarClientesSquads, podeUsarCrm, podeUsarSquads, podeVerCampanhas });
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full py-6 px-4">
      <div className="flex items-center gap-3 mb-10 px-2">
        <img
          src="/lp_kairon_company.png"
          alt="Kairon Company"
          className="w-9 h-9 rounded-xl object-contain shrink-0"
        />
        <div>
          <p className="text-sm font-bold text-white">Kairon Company</p>
          <p className="text-xs text-muted-foreground">Operações & Comercial</p>
        </div>
      </div>

      <nav className="flex-1 flex flex-col">
        {(() => {
          const firstGroupIdx = navItems.findIndex((i) => i.children);
          return navItems.map((item, idx) => {
          const Icon = item.icon;

          if (item.children) {
            const isOpen = openGroups[item.id] ?? true;
            return (
              <div key={item.id} className={idx === firstGroupIdx ? 'mt-7' : 'mt-5'}>
                <button
                  onClick={() => toggleGroup(item.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold transition-colors duration-200 text-muted-foreground/60 hover:text-muted-foreground"
                >
                  <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mt-1 space-y-1"
                    >
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        return (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            onClick={() => setMobileOpen(false)}
                            className={({ isActive }) =>
                              `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 border ${
                                isActive
                                  ? 'text-white'
                                  : 'border-transparent text-muted-foreground hover:text-white hover:bg-white/5'
                              }`
                            }
                            style={({ isActive }) => (isActive ? activeStyle : {})}
                          >
                            {({ isActive }) => (
                              <>
                                <ChildIcon className="w-4 h-4 shrink-0" />
                                <span className="font-medium">{child.label}</span>
                                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={activeDot} />}
                              </>
                            )}
                          </NavLink>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 border ${
                  isActive
                    ? 'text-white'
                    : 'border-transparent text-muted-foreground hover:text-white hover:bg-white/5'
                }`
              }
              style={({ isActive }) => (isActive ? activeStyle : {})}
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="font-medium">{item.label}</span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={activeDot} />}
                </>
              )}
            </NavLink>
          );
        });
        })()}
      </nav>

      <div className="mt-4 space-y-2">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-colors border border-transparent"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="font-medium">{t('nav.logout')}</span>
        </button>
        <div className="glass-card rounded-xl p-3">
          <p className="text-xs text-muted-foreground text-center">Marketing Ops v1.0</p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex glass-sidebar w-60 fixed left-0 top-0 h-full z-30 flex-col">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="glass-sidebar fixed left-0 top-0 h-full w-60 z-50 md:hidden flex flex-col"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
