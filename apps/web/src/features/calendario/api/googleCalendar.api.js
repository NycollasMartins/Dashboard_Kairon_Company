import { supabase } from '@/infrastructure/supabase/client';

// Extrai a mensagem de erro retornada pela Edge Function (body { error }).
async function unwrapInvoke({ data, error }) {
  if (error) {
    try {
      const response = error.context?.response;
      if (response) {
        const body = await response.json();
        if (body?.error) throw new Error(body.error);
      }
    } catch (e) {
      if (e instanceof Error && e.message) throw e;
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
