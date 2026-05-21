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
  },
  squads: {
    all: ['squads'],
  },
  usuarios: {
    all: ['usuarios'],
  },
  leads: {
    all: ['leads'],
  },
};
