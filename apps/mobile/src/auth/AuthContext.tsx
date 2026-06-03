import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchProfile, mapProfileToUser } from '@kairon/core/auth/session';
import { supabase } from '@kairon/core/supabase/client';

export type AppUser = {
  id: string;
  email: string;
  full_name: string;
  role: string;
};

type AuthContextValue = {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Porta do AuthContext do web para RN. Mesma logica (getSession +
 * onAuthStateChange + fetchProfile/mapProfileToUser do core), sem `window`
 * (o gating de rota fica no _layout via expo-router).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const hydrateUser = useCallback(async (session: any) => {
    if (!session) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      return;
    }
    try {
      const profile = await fetchProfile(session.user.id);
      const { user: mappedUser, archived } = mapProfileToUser(profile, session.user);
      if (archived) {
        await supabase.auth.signOut();
        setUser(null);
        setIsAuthenticated(false);
        return;
      }
      setUser(mappedUser);
      setIsAuthenticated(true);
    } catch {
      // Falha ao buscar profile: mantem sessao com defaults minimos.
      setUser({ id: session.user.id, email: session.user.email ?? '', full_name: '', role: 'sdr' });
      setIsAuthenticated(true);
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => hydrateUser(session))
      .catch(() => hydrateUser(null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateUser(session);
    });

    return () => subscription.unsubscribe();
  }, [hydrateUser]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoadingAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
