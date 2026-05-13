import { useState } from 'react';
import ClientesPage from '@/features/clientes/pages/ClientesPage';
import ClienteDetalhePage from '@/features/clientes/pages/ClienteDetalhePage';

export default function ClientesPageWrapper() {
  const [clienteDetalheId, setClienteDetalheId] = useState(null);

  if (clienteDetalheId) {
    return (
      <ClienteDetalhePage
        clienteId={clienteDetalheId}
        onBack={() => setClienteDetalheId(null)}
      />
    );
  }

  return <ClientesPage onVerCliente={(id) => setClienteDetalheId(id)} />;
}
