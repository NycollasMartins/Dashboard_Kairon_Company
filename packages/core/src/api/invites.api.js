import { supabase } from '../supabase/client.js';

const VIEW = 'user_invites_view';

// Papéis que a edge function 'invite-user' já aceita de longa data. Para papéis
// mais novos (não listados aqui), convidamos com um papel base e ajustamos o
// papel real direto no profile, evitando depender do redeploy da função.
const ROLES_BOOTSTRAP_SEGUROS = ['admin', 'social media', 'editor', 'closer', 'sdr', 'bdr', 'head', 'dev'];

function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

async function unwrapInvoke({ data, error }) {
  if (error) {
    let message =
      (data && (data.error || data.message)) || error.message || 'Erro ao chamar função.';
    // supabase-js (FunctionsHttpError) guarda a Response do erro em `error.context`.
    // Em algumas versões é a própria Response; em outras vem em `error.context.response`.
    const ctx = error.context;
    const response =
      ctx && typeof ctx.json === 'function'
        ? ctx
        : ctx?.response && typeof ctx.response.json === 'function'
          ? ctx.response
          : null;
    try {
      if (response) {
        const body = await response.json();
        if (body?.error) message = body.error;
        else if (body?.message) message = body.message;
      }
    } catch {
      // body não era JSON — usa o que já tinha
    }
    throw new Error(message);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

function currentOrigin() {
  // Prioriza VITE_SITE_URL (definido no .env do web) para o link do convite sempre
  // apontar pro dominio correto — mesmo convidando a partir de um ambiente de dev.
  // O fallback e a origem atual do navegador.
  try {
    const siteUrl = import.meta?.env?.VITE_SITE_URL;
    if (siteUrl) return String(siteUrl).trim().replace(/\/+$/, '');
  } catch {
    // ambiente sem import.meta.env (ex.: bundlers que nao injetam) — ignora
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return undefined;
}

export const invitesApi = {
  list: () =>
    supabase
      .from(VIEW)
      .select('id, email, full_name, role, invited_at, last_sign_in_at, pending')
      .eq('pending', true)
      .order('invited_at', { ascending: false })
      .then(unwrap),

  create: async ({ email, full_name, role }) => {
    // A edge function 'invite-user' valida o papel contra uma lista fixa no
    // código dela. Papéis mais novos (ex.: 'tv') podem não estar na versão em
    // produção ainda. Para não depender do redeploy da função, convidamos com um
    // papel base que ela já aceita e gravamos o papel real direto no profile
    // (o CHECK do banco já permite o papel novo).
    const precisaAjuste = !ROLES_BOOTSTRAP_SEGUROS.includes(role);
    const roleConvite = precisaAjuste ? 'sdr' : role;

    const res = await supabase.functions
      .invoke('invite-user', {
        body: { email, full_name, role: roleConvite, origin: currentOrigin() },
      })
      .then(unwrapInvoke);

    if (precisaAjuste && res?.user?.id) {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', res.user.id);
      if (error) throw new Error(error.message || 'Convite enviado, mas falha ao gravar o papel.');
      res.user.role = role;
    }
    return res;
  },

  resend: (email) =>
    supabase.functions
      .invoke('invite-user', {
        body: { email, resend: true, origin: currentOrigin() },
      })
      .then(unwrapInvoke),

  cancel: (user_id) =>
    supabase.functions
      .invoke('cancel-invite', { body: { user_id } })
      .then(unwrapInvoke),
};
