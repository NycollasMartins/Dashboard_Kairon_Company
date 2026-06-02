import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { fetchProfile, mapProfileToUser } from '@kairon/core/auth/session';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const hydrateUser = useCallback(async (session) => {
    if (!session) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }
    try {
      const profile = await fetchProfile(session.user.id);
      const { user: mappedUser, archived } = mapProfileToUser(profile, session.user);
      if (archived) {
        await supabase.auth.signOut();
        setUser(null);
        setIsAuthenticated(false);
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.replace('/login?reason=archived');
        }
        return;
      }
      setUser(mappedUser);
      setIsAuthenticated(true);
    } catch {
      setUser({ id: session.user.id, email: session.user.email, full_name: '', role: 'sdr' });
      setIsAuthenticated(true);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => hydrateUser(session))
      .catch(() => hydrateUser(null));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateUser(session);
    });

    return () => subscription.unsubscribe();
  }, [hydrateUser]);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    const { data: { session } } = await supabase.auth.getSession();
    await hydrateUser(session);
  }, [hydrateUser]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      authChecked,
      checkUserAuth,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
