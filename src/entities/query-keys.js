export const queryKeys = {
  clientes: {
    all: ['clientes'],
    detail: (id) => ['clientes', id],
  },
  tarefas: {
    all: ['tarefas'],
    byCliente: (clienteId) => ['tarefas', 'cliente', clienteId],
    byProjeto: (projetoId) => ['tarefas', 'projeto', projetoId],
  },
  projetos: {
    all: ['projetos'],
    byCliente: (clienteId) => ['projetos', 'cliente', clienteId],
    detail: (id) => ['projetos', id],
  },
  squads: {
    all: ['squads'],
    detail: (id) => ['squads', id],
  },
  usuarios: {
    all: ['usuarios'],
  },
  convitesPendentes: {
    all: ['convitesPendentes'],
  },
  leads: {
    all: ['leads'],
  },
  contratos: {
    all: ['contratos'],
    byCliente: (clienteId) => ['contratos', 'cliente', clienteId],
  },
  campanhas: {
    all: ['campanhas'],
    detail: (id) => ['campanhas', id],
    metrics: (id) => ['campanhas', id, 'metrics'],
  },
  calendario: {
    all: ['calendario'],
    googleStatus: ['calendario', 'google-status'],
  },
};
