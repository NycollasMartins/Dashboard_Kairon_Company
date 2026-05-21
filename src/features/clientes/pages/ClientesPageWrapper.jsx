import { useState } from 'react';
import { useAuth } from '@/features/auth/context/AuthContext';
import RestrictedAccessCard from '@/shared/components/RestrictedAccessCard';
import ClientesPage from '@/features/clientes/pages/ClientesPage';
import ClienteDetalhePage from '@/features/clientes/pages/ClienteDetalhePage';

const OPERACIONAL_ROLES = ['admin', 'social media'];

export default function ClientesPageWrapper() {
  const { user } = useAuth();
  const [clienteDetalheId, setClienteDetalheId] = useState(null);

  if (!OPERACIONAL_ROLES.includes(user?.role)) {
    return (
      <RestrictedAccessCard
        description="Apenas usuários com perfil admin ou social media podem acessar Clientes."
      />
    );
  }

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
