import { useNavigate } from 'react-router-dom';
import { Clock, LogOut } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';

// Tela única do papel "pendente": conta criada sem convite (ex.: login social
// de quem ainda não é da equipe). O banco não libera nenhum dado para esse
// papel (private.is_member); um admin precisa definir o papel em Membros.
export default function AguardandoAprovacaoPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="glass-card border border-white/5 rounded-2xl p-10 max-w-md w-full flex flex-col items-center gap-4 text-center animate-fade-in">
        <div className="w-12 h-12 rounded-xl bg-[#EA3935]/10 flex items-center justify-center">
          <Clock className="w-5 h-5 text-[#EA3935]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Aguardando aprovação</p>
          <p className="text-xs text-muted-foreground mt-1">
            Sua conta{user?.email ? ` (${user.email})` : ''} foi criada, mas ainda não tem acesso ao
            dashboard. Peça a um administrador para liberar seu perfil.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-white hover:bg-white/5 transition-colors border border-white/10"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  );
}
