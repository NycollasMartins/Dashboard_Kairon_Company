import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';
import { setMoneyConfig, CURRENCIES } from '@/shared/lib/money';
import { translate } from '@/shared/i18n';

const PreferencesContext = createContext(null);

const DEFAULTS = { language: 'pt', currency: 'BRL', theme: 'dark' };
const FX_FALLBACK = { USD: 0.185, EUR: 0.17 }; // BRL -> moeda (aprox., se a cotação falhar)
const LS_PREFS = 'kairon:prefs';
const LS_FX = 'kairon:fx';

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LS_PREFS)) || {}; } catch { return {}; }
}

export function PreferencesProvider({ children }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(() => ({ ...DEFAULTS, ...readLocal() }));
  const [, setVersion] = useState(0); // força re-render quando a moeda/cotação muda

  // Sincroniza com as preferências salvas no servidor quando o usuário carrega.
  useEffect(() => {
    if (!user) return;
    const server = user.preferences && typeof user.preferences === 'object' ? user.preferences : {};
    if (Object.keys(server).length) setPrefs((p) => ({ ...DEFAULTS, ...p, ...server }));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tema: classe 'light' no <html> (dark é o padrão).
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'light') root.classList.add('light');
    else root.classList.remove('light');
  }, [prefs.theme]);

  // Moeda + cotação (BRL -> moeda alvo). Atualiza a config global de dinheiro.
  useEffect(() => {
    let active = true;
    async function applyCurrency() {
      if (prefs.currency === 'BRL') {
        setMoneyConfig({ currency: 'BRL', rate: 1 });
        if (active) setVersion((v) => v + 1);
        return;
      }
      let rate;
      try {
        const cached = JSON.parse(localStorage.getItem(LS_FX) || 'null');
        if (cached && Date.now() - cached.ts < 12 * 3600 * 1000 && cached.rates?.[prefs.currency]) {
          rate = cached.rates[prefs.currency];
        } else {
          const res = await fetch('https://open.er-api.com/v6/latest/BRL');
          const json = await res.json();
          if (json?.rates) {
            localStorage.setItem(LS_FX, JSON.stringify({ ts: Date.now(), rates: json.rates }));
            rate = json.rates[prefs.currency];
          }
        }
      } catch {
        rate = undefined;
      }
      rate = rate ?? FX_FALLBACK[prefs.currency] ?? 1;
      setMoneyConfig({ currency: prefs.currency, rate });
      if (active) setVersion((v) => v + 1);
    }
    applyCurrency();
    return () => { active = false; };
  }, [prefs.currency]);

  const persist = useCallback(async (next) => {
    try { localStorage.setItem(LS_PREFS, JSON.stringify(next)); } catch { /* ignore */ }
    if (user?.id) {
      try { await supabase.from('profiles').update({ preferences: next }).eq('id', user.id); } catch { /* ignore */ }
    }
  }, [user?.id]);

  const update = useCallback((patch) => {
    setPrefs((p) => { const next = { ...p, ...patch }; persist(next); return next; });
  }, [persist]);

  const t = useCallback((key) => translate(prefs.language, key), [prefs.language]);

  const value = {
    language: prefs.language,
    currency: prefs.currency,
    theme: prefs.theme,
    currencyInfo: CURRENCIES[prefs.currency] ?? CURRENCIES.BRL,
    setLanguage: (language) => update({ language }),
    setCurrency: (currency) => update({ currency }),
    setTheme: (theme) => update({ theme }),
    toggleTheme: () => update({ theme: prefs.theme === 'light' ? 'dark' : 'light' }),
    t,
  };

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within a PreferencesProvider');
  return ctx;
}
