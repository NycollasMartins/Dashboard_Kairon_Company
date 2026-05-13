import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';

const BRAND_FROM = '#EA3935';
const BRAND_TO = '#C12D29';

function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor" aria-hidden {...props}>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      await checkUserAuth();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message ?? 'Ocorreu um erro. Tente novamente.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Informe seu e-mail no campo acima para recuperar a senha.');
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      });
      if (resetError) throw resetError;
      setInfo('Enviamos um link de recuperação para o seu e-mail.');
    } catch (err) {
      setError(err.message ?? 'Não foi possível enviar o e-mail de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    setError('');
    setInfo('');
    setOauthLoading(provider);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message ?? 'Não foi possível iniciar o login social.');
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <div className="flex min-h-dvh min-h-screen flex-col bg-zinc-950">
      <div className="flex min-h-dvh flex-1 flex-col md:min-h-screen md:flex-row w-full">
        {/* Painel esquerdo — branding */}
        <aside className="relative md:w-[42%] min-h-[220px] shrink-0 overflow-hidden md:min-h-screen md:border-r md:border-zinc-800">
          <div className="absolute inset-0 bg-zinc-950" />
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
            style={{ backgroundImage: "url('/login-bg.png')" }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `linear-gradient(145deg, ${BRAND_FROM}cc 0%, ${BRAND_TO}99 45%, rgba(24,24,27,0.92) 100%)`,
            }}
          />
          <div className="relative z-10 flex min-h-[220px] flex-col justify-between p-8 md:min-h-screen md:p-10 text-white">
            <div className="space-y-3 max-w-sm">
              <p className="text-sm font-medium text-white/85">Kairon Company</p>
              <h2 className="text-2xl sm:text-3xl md:text-[1.65rem] lg:text-3xl font-bold leading-tight tracking-tight text-balance">
                Conduzindo marcas e empresas com comunicação e marketing digital que performam.
              </h2>
            </div>
            <div className="pt-6 md:pt-0 max-w-sm">
              <p className="text-sm font-medium leading-relaxed text-white/80 text-pretty">
                Da estratégia à execução: sua marca no centro do digital.
              </p>
            </div>
          </div>
        </aside>

        {/* Painel direito — formulário */}
        <main className="flex flex-1 flex-col justify-center bg-zinc-900 px-6 py-10 sm:px-10 sm:py-12 md:min-h-screen md:px-12 md:py-14">
          <div className="mx-auto w-full max-w-md space-y-6">
            <header className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">Bem-vindo de volta</h1>
              <p className="text-sm text-zinc-400">
                Acesse o painel e acompanhe o que importa para o seu time. Novos acessos são criados apenas pela
                equipe.
              </p>
            </header>

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {info && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {info}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="login-email" className="text-sm font-semibold text-zinc-200">
                  E-mail
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-[#EA3935]/35"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="login-password" className="text-sm font-semibold text-zinc-200">
                    Senha
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="text-xs font-semibold text-[#EA3935] hover:text-[#C12D29] disabled:opacity-50 transition-colors shrink-0"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 pr-11 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-[#EA3935]/35"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md shadow-[#EA3935]/25 transition-opacity disabled:opacity-60 hover:opacity-[0.97]"
                style={{ background: loading ? 'rgba(234, 57, 53, 0.55)' : `linear-gradient(135deg, ${BRAND_FROM}, ${BRAND_TO})` }}
              >
                {loading ? 'Aguarde...' : 'Entrar'}
              </button>
            </form>

            <div className="relative flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-zinc-800" />
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Ou</span>
              <span className="h-px flex-1 bg-zinc-800" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!!oauthLoading}
                onClick={() => handleOAuth('google')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800 disabled:opacity-60"
              >
                {oauthLoading === 'google' ? (
                  <span className="text-zinc-400">Abrindo…</span>
                ) : (
                  <>
                    <GoogleIcon />
                    Entrar com Google
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={!!oauthLoading}
                onClick={() => handleOAuth('apple')}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800 disabled:opacity-60"
              >
                {oauthLoading === 'apple' ? (
                  <span className="text-zinc-400">Abrindo…</span>
                ) : (
                  <>
                    <AppleIcon />
                    Entrar com Apple
                  </>
                )}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
