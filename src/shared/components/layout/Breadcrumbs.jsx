import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Home, ChevronRight } from 'lucide-react';
import { clientesApi } from '@/features/clientes/api/clientes.api';
import { projetosApi } from '@/features/projetos/api/projetos.api';
import { squadsApi } from '@/features/squads/api/squads.api';
import { queryKeys } from '@/entities/query-keys';

function ClienteCrumbLabel({ id }) {
  const { data } = useQuery({
    queryKey: queryKeys.clientes.detail(id),
    queryFn: () => clientesApi.get(id),
    enabled: !!id,
    staleTime: 60_000,
  });
  return <span className="truncate max-w-[180px]">{data?.nome ?? 'Cliente'}</span>;
}

function ProjetoCrumbLabel({ id }) {
  const { data } = useQuery({
    queryKey: queryKeys.projetos.detail(id),
    queryFn: () => projetosApi.get(id),
    enabled: !!id,
    staleTime: 60_000,
  });
  return <span className="truncate max-w-[180px]">{data?.nome ?? 'Projeto'}</span>;
}

function SquadCrumbLabel({ id }) {
  const { data } = useQuery({
    queryKey: queryKeys.squads.detail(id),
    queryFn: () => squadsApi.get(id),
    enabled: !!id,
    staleTime: 60_000,
  });
  return <span className="truncate max-w-[180px]">{data?.nome ?? 'Squad'}</span>;
}

function buildCrumbs(pathname) {
  if (pathname === '/' || pathname === '') return [];

  if (pathname === '/administrativo') {
    return [
      { key: 'gestao', label: 'Gestão' },
      { key: 'membros', label: 'Membros' },
    ];
  }

  if (pathname === '/comercial') {
    return [
      { key: 'comercial', label: 'Comercial' },
      { key: 'pipeline-leads', label: 'Pipeline Leads' },
    ];
  }

  if (pathname === '/tarefas') {
    return [
      { key: 'operacional', label: 'Operacional' },
      { key: 'tarefas', label: 'Tarefas' },
    ];
  }

  if (pathname === '/squads') {
    return [
      { key: 'operacional', label: 'Operacional' },
      { key: 'squads', label: 'Squads' },
    ];
  }

  const squadMatch = pathname.match(/^\/squads\/([^/]+)$/);
  if (squadMatch) {
    const [, squadId] = squadMatch;
    return [
      { key: 'operacional', label: 'Operacional' },
      { key: 'squads', label: 'Squads', to: '/squads' },
      { key: `squad-${squadId}`, label: <SquadCrumbLabel id={squadId} /> },
    ];
  }

  if (pathname === '/clientes') {
    return [
      { key: 'operacional', label: 'Operacional' },
      { key: 'clientes', label: 'Clientes' },
    ];
  }

  const clienteMatch = pathname.match(/^\/clientes\/([^/]+)$/);
  if (clienteMatch) {
    const [, clienteId] = clienteMatch;
    return [
      { key: 'operacional', label: 'Operacional' },
      { key: 'clientes', label: 'Clientes', to: '/clientes' },
      { key: `cliente-${clienteId}`, label: <ClienteCrumbLabel id={clienteId} /> },
    ];
  }

  const projetoMatch = pathname.match(/^\/clientes\/([^/]+)\/projetos\/([^/]+)$/);
  if (projetoMatch) {
    const [, clienteId, projetoId] = projetoMatch;
    return [
      { key: 'operacional', label: 'Operacional' },
      { key: 'clientes', label: 'Clientes', to: '/clientes' },
      { key: `cliente-${clienteId}`, label: <ClienteCrumbLabel id={clienteId} />, to: `/clientes/${clienteId}` },
      { key: `projeto-${projetoId}`, label: <ProjetoCrumbLabel id={projetoId} /> },
    ];
  }

  return [];
}

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = buildCrumbs(pathname);
  const isRoot = crumbs.length === 0;

  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
      <Link
        to="/"
        aria-label="Visão Geral"
        title="Visão Geral"
        className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors shrink-0 ${
          isRoot
            ? 'bg-white/10 text-white'
            : 'text-white/80 hover:text-white hover:bg-white/5'
        }`}
      >
        <Home className="w-3.5 h-3.5" />
      </Link>

      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <div key={crumb.key} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className="w-3.5 h-3.5 text-white/40 shrink-0" />
            {isLast ? (
              <span className="bg-white/10 text-white px-2 py-1 rounded-md font-medium truncate">
                {crumb.label}
              </span>
            ) : crumb.to ? (
              <Link
                to={crumb.to}
                className="text-white/80 hover:text-white px-2 py-1 rounded-md hover:bg-white/5 transition-colors truncate"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-white/80 px-2 py-1 truncate">{crumb.label}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
