import { supabase } from '@/infrastructure/supabase/client';

// Extrai a mensagem de erro retornada pela Edge Function (body { error }).
// No supabase-js, em erro HTTP o corpo vem em `error.context` (que já é a
// Response); algumas versões aninham em `error.context.response`. Tratamos os
// dois casos para não cair na mensagem genérica "non-2xx status code".
async function unwrapInvoke({ data, error }) {
  if (error) {
    const resp = typeof error?.context?.json === 'function'
      ? error.context
      : error?.context?.response;
    if (resp && typeof resp.json === 'function') {
      const body = await resp.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    throw error;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export const googleCalendarApi = {
  // Status da conexão (admin/head). Retorna { connected, google_calendar_id, ... }.
  status: () =>
    supabase.rpc('google_calendar_status').then(({ data, error }) => {
      if (error) throw error;
      return data?.[0] ?? { connected: false };
    }),

  // Inicia o fluxo OAuth: retorna a URL de consentimento do Google (admin).
  getAuthUrl: () =>
    supabase.functions
      .invoke('google-calendar-oauth', { body: { action: 'authUrl' } })
      .then(unwrapInvoke),

  // Desconecta a conta Google (apaga tokens) — admin.
  disconnect: () =>
    supabase.functions
      .invoke('google-calendar-oauth', { body: { action: 'disconnect' } })
      .then(unwrapInvoke),

  // Empurra um evento local para o Google. Retorna { google_event_id }.
  push: (event) =>
    supabase.functions
      .invoke('google-calendar-sync', { body: { action: 'push', event } })
      .then(unwrapInvoke),

  // Remove um evento no Google pelo id.
  deleteRemote: (google_event_id) =>
    supabase.functions
      .invoke('google-calendar-sync', { body: { action: 'delete', google_event_id } })
      .then(unwrapInvoke),

  // Importa eventos do Google para o dashboard. Retorna { imported }.
  pull: () =>
    supabase.functions
      .invoke('google-calendar-sync', { body: { action: 'pull' } })
      .then(unwrapInvoke),
};
