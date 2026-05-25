import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { useAuth } from '@/features/auth/context/AuthContext';

const BRAND_FROM = '#EA3935';
const BRAND_TO = '#C12D29';

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  const isMountedRef = useRef(true);

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // O Supabase processa o token da URL automaticamente e cria a sessão.
    // Esperamos brevemente caso o onAuthStateChange ainda não tenha disparado.
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data?.session) {
        setHasSession(true);
        setInviteEmail(data.session.user?.email ?? '');
        setCheckingSession(false);
      } else {
        // tenta de novo após pequena espera (token assíncrono)
        setTimeout(async () => {
          if (cancelled) return;
          const { data: data2 } = await supabase.auth.getSession();
          if (data2?.session) {
            setHasSession(true);
            setInviteEmail(data2.session.user?.email ?? '');
          }
          setCheckingSession(false);
        }, 600);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('A senha precisa ter no mínimo 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;

      // Limpa o hash do invite (#access_token=...) que vem do link do email,
      // senão o Supabase reprocessa e a navegação fica presa.
      if (typeof window !== 'undefined' && window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname);
      }

      // Atualiza o AuthContext em background — não bloqueia o redirect.
      checkUserAuth().catch(() => {});

      setSuccess(true);

      // Navegação hard garante saída limpa da página de aceite,
      // mesmo que o React Router se confunda com o hash residual.
      setTimeout(() => {
        if (!isMountedRef.current) return;
        window.location.assign('/');
      }, 800);
    } catch (err) {
      setError(err?.message ?? 'Não foi possível definir a senha.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh min-h-screen flex-col bg-zinc-950">
      <div className="flex min-h-dvh flex-1 flex-col md:min-h-screen md:flex-row w-full">
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
                Bem-vindo ao time. Defina sua senha e comece a navegar pelo dashboard.
              </h2>
            </div>
            <div className="pt-6 md:pt-0 max-w-sm">
              <p className="text-sm font-medium leading-relaxed text-white/80 text-pretty">
                Sua conta foi criada por um administrador. Em segundos você estará dentro.
              </p>
            </div>
          </div>
        </aside>

        <main className="flex flex-1 flex-col justify-center bg-zinc-900 px-6 py-10 sm:px-10 sm:py-12 md:min-h-screen md:px-12 md:py-14">
          <div className="mx-auto w-full max-w-md space-y-6">
            <header className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
                Definir senha de acesso
              </h1>
              <p className="text-sm text-zinc-400">
                {inviteEmail
                  ? `Você foi convidado como ${inviteEmail}. Escolha uma senha para entrar no dashboard.`
                  : 'Escolha uma senha para acessar o dashboard.'}
              </p>
            </header>

            {checkingSession && (
              <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-300">
                <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-200 rounded-full animate-spin" />
                Verificando convite...
              </div>
            )}

            {!checkingSession && !hasSession && (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Link de convite inválido ou expirado. Peça ao administrador para reenviar.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/login', { replace: true })}
                  className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md shadow-[#EA3935]/25 transition-opacity hover:opacity-[0.97]"
                  style={{ background: `linear-gradient(135deg, ${BRAND_FROM}, ${BRAND_TO})` }}
                >
                  Voltar ao login
                </button>
              </div>
            )}

            {!checkingSession && hasSession && !success && (
              <>
                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="new-password" className="text-sm font-semibold text-zinc-200">
                      Nova senha
                    </label>
                    <div className="relative">
                      <input
                        id="new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={8}
                        autoComplete="new-password"
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
                    <p className="text-[11px] text-zinc-500">Mínimo de 8 caracteres.</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirm-password" className="text-sm font-semibold text-zinc-200">
                      Confirmar senha
                    </label>
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-50 placeholder:text-zinc-500 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-[#EA3935]/35"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-md shadow-[#EA3935]/25 transition-opacity disabled:opacity-60 hover:opacity-[0.97]"
                    style={{
                      background: loading
                        ? 'rgba(234, 57, 53, 0.55)'
                        : `linear-gradient(135deg, ${BRAND_FROM}, ${BRAND_TO})`,
                    }}
                  >
                    {loading ? 'Definindo...' : 'Definir senha e entrar'}
                  </button>
                </form>
              </>
            )}

            {success && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Senha definida com sucesso!</p>
                  <p className="text-emerald-300/80">Redirecionando para o dashboard…</p>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
