import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Shield, Briefcase, Users, CheckSquare,
  ChevronDown, X, Layers, LogOut, Target, TrendingUp, Settings, Megaphone, Calendar, DollarSign, Goal,
} from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useNotifications } from '@/features/notifications/NotificationsContext';

const getNavItems = ({ isAdmin, isTv, podeVerTarefas, podeUsarClientesSquads, podeUsarCrm, podeUsarSquads, podeVerCampanhas }) => {
  // Papel "TV": acesso somente à aba Metas.
  if (isTv) return [{ to: '/metas', label: 'Metas', icon: Goal }];
  return [
  { to: '/', label: 'Visão Geral', icon: LayoutDashboard, end: true },
  { to: '/calendario', label: 'Calendário', icon: Calendar },
  { to: '/metas', label: 'Metas', icon: Goal },
  ...(podeUsarCrm
    ? [{
        label: 'Comercial', icon: Target,
        children: [
          { to: '/comercial', label: 'Pipeline Leads', icon: TrendingUp },
        ],
      }]
    : []),
  ...(podeVerTarefas || podeVerCampanhas
    ? [{
        label: 'Operacional', icon: Briefcase,
        children: [
          ...(podeVerCampanhas ? [{ to: '/campanhas', label: 'Campanhas', icon: Megaphone }] : []),
          ...(podeVerTarefas ? [{ to: '/tarefas', label: 'Tarefas', icon: CheckSquare }] : []),
          ...(podeUsarClientesSquads ? [{ to: '/clientes', label: 'Clientes', icon: Users }] : []),
          ...(podeUsarSquads ? [{ to: '/squads', label: 'Squads', icon: Layers }] : []),
        ],
      }]
    : []),
  ...(isAdmin
    ? [{
        label: 'Gestão', icon: Settings,
        children: [
          { to: '/administrativo', label: 'Membros', icon: Shield },
          { to: '/financeiro', label: 'Financeiro', icon: DollarSign },
        ],
      }]
    : []),
  ];
};

const activeStyle = { background: 'rgba(234, 57, 53,0.15)', borderColor: 'rgba(234, 57, 53,0.3)' };
const activeDot = { background: '#EA3935' };

export default function Sidebar({
  isAdmin = false,
  isTv = false,
  podeVerTarefas = false,
  podeUsarClientesSquads = false,
  podeUsarCrm = false,
  podeUsarSquads = false,
  podeVerCampanhas = false,
  mobileOpen,
  setMobileOpen,
}) {
  const [openGroups, setOpenGroups] = useState({ Comercial: true, Operacional: true });
  const toggleGroup = (label) =>
    setOpenGroups((s) => ({ ...s, [label]: !s[label] }));
  const navItems = getNavItems({ isAdmin, isTv, podeVerTarefas, podeUsarClientesSquads, podeUsarCrm, podeUsarSquads, podeVerCampanhas });
  const { logout } = useAuth();
  const { leadUnreadCount } = useNotifications();
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
            const isOpen = openGroups[item.label] ?? true;
            return (
              <div key={item.label} className={idx === firstGroupIdx ? 'mt-7' : 'mt-5'}>
                <button
                  onClick={() => toggleGroup(item.label)}
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
                                {child.to === '/comercial' && leadUnreadCount > 0 ? (
                                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-[#EA3935] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {leadUnreadCount > 99 ? '99+' : leadUnreadCount}
                                  </span>
                                ) : isActive ? (
                                  <div className="ml-auto w-1.5 h-1.5 rounded-full" style={activeDot} />
                                ) : null}
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
          <span className="font-medium">Sair</span>
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
