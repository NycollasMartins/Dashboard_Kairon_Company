import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import Breadcrumbs from '@/shared/components/layout/Breadcrumbs';
import NotificationBell from '@/features/notifications/NotificationBell';

export default function Header({ onMenuClick }) {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const initials = user?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`px-6 py-4 flex items-center justify-between sticky top-0 z-20 transition-colors duration-200 ${
        scrolled ? 'glass-card' : 'bg-transparent'
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden text-muted-foreground hover:text-white transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white text-zinc-900 text-sm font-semibold cursor-pointer shadow-sm">
          {initials}
        </div>
      </div>
    </header>
  );
}
