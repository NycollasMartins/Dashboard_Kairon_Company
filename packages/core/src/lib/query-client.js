import { QueryClient } from '@tanstack/react-query';

/**
 * Cria um QueryClient com os defaults compartilhados entre web e mobile.
 * Cada app instancia o seu (o web reusa via shim em shared/lib/query-client).
 * @param {import('@tanstack/react-query').QueryClientConfig} [overrides]
 */
export function makeQueryClient(overrides = {}) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
      },
      ...overrides.defaultOptions,
    },
    ...overrides,
  });
}
