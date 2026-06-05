// O @kairon/core e JS puro (sem .d.ts). Declaramos os subpaths usados para
// silenciar TS7016 e manter a DX. Os tipos ficam como `any` (resolvidos em runtime
// pelo Metro). O subpath ./supabase/client e tipado no proprio core (cast para
// SupabaseClient), entao nao precisa ser declarado aqui.
declare module '@kairon/core/auth/session' {
  export function fetchProfile(userId: string): Promise<any>;
  export function mapProfileToUser(
    profile: any,
    sessionUser: any
  ): { user: { id: string; email: string; full_name: string; role: string } | null; archived: boolean };
}

declare module '@kairon/core/lib/query-client' {
  import type { QueryClient, QueryClientConfig } from '@tanstack/react-query';
  export function makeQueryClient(overrides?: QueryClientConfig): QueryClient;
}

declare module '@kairon/core/api/tarefas.api' {
  export const tarefasApi: {
    list: () => Promise<any[]>;
    byCliente: (clienteId: string) => Promise<any[]>;
    byProjeto: (projetoId: string) => Promise<any[]>;
    create: (data: any) => Promise<any>;
    update: (id: string, data: any) => Promise<any>;
    delete: (id: string) => Promise<any>;
  };
}

declare module '@kairon/core/api/projetos.api' {
  export const projetosApi: {
    list: () => Promise<any[]>;
    byCliente: (clienteId: string) => Promise<any[]>;
    get: (id: string) => Promise<any>;
    create: (data: any) => Promise<any>;
    update: (id: string, data: any) => Promise<any>;
    delete: (id: string) => Promise<any>;
  };
}

declare module '@kairon/core/api/calendario.api' {
  export const calendarioApi: {
    list: () => Promise<any[]>;
    create: (data: any) => Promise<any>;
    update: (id: string, data: any) => Promise<any>;
    listPeople: () => Promise<any[]>;
    patch: (id: string, partial: any) => Promise<any>;
    remove: (id: string) => Promise<void>;
  };
}

declare module '@kairon/core/api/leads.api' {
  export const leadsApi: {
    list: () => Promise<any[]>;
    create: (data: any) => Promise<any>;
    update: (id: string, data: any) => Promise<any>;
    delete: (id: string) => Promise<void>;
    convertToCliente: (leadId: string, extras?: any) => Promise<string>;
  };
}

declare module '@kairon/core/api/users.api' {
  export const usersApi: {
    list: () => Promise<any[]>;
    update: (id: string, data: any) => Promise<any>;
    archive: (userId: string) => Promise<any>;
    unarchive: (userId: string) => Promise<any>;
    remove: (userId: string) => Promise<any>;
  };
}
