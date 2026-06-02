import CalendarioPage from '@/features/calendario/pages/CalendarioPage';

// O Calendário é visível a todos os usuários autenticados.
// A gestão (criar/editar/excluir) é restrita a admin/head dentro da página
// e reforçada pela RLS do banco.
export default function CalendarioPageWrapper() {
  return <CalendarioPage />;
}
