import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import { Mail, Phone, Building2, Clock, AlertCircle } from 'lucide-react';

const SLA_MS = 10 * 60 * 1000;

function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function tagColorFor(key) {
  const palette = [
    { bg: 'rgba(234,57,53,0.12)', fg: '#EA3935' },
    { bg: 'rgba(59,130,246,0.14)', fg: '#60A5FA' },
    { bg: 'rgba(16,185,129,0.14)', fg: '#34D399' },
    { bg: 'rgba(168,85,247,0.14)', fg: '#C084FC' },
    { bg: 'rgba(245,158,11,0.14)', fg: '#FBBF24' },
    { bg: 'rgba(236,72,153,0.14)', fg: '#F472B6' },
  ];
  if (!key) return palette[0];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function relativeDate(iso) {
  if (!iso) return null;
  const created = new Date(iso);
  const now = new Date();
  const diffMs = now - created;
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return 'agora';
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return `${Math.floor(diffD / 7)}sem`;
}

function SlaBadge({ startedAt }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - new Date(startedAt).getTime();
  const remaining = SLA_MS - elapsed;
  const expired = remaining <= 0;

  if (expired) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-semibold text-red-300 bg-red-500/15 border border-red-500/30 rounded-md px-1.5 py-0.5 shrink-0 animate-pulse">
        <AlertCircle className="w-3 h-3" />
        SLA vencido
      </span>
    );
  }

  const totalSec = Math.max(0, Math.floor(remaining / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return (
    <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/25 rounded-md px-1.5 py-0.5 shrink-0 tabular-nums">
      <Clock className="w-3 h-3" />
      {mm}:{ss}
    </span>
  );
}

export default function LeadCard({ lead, index, onOpen }) {
  const responsavelNome = lead.responsavel?.full_name || lead.responsavel?.email;
  const created = relativeDate(lead.created_at);
  const empresa = lead.empresa;
  const showSla = lead.status === 'em_atendimento' && lead.atendimento_iniciado_em;

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => {
        const child = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => onOpen(lead)}
            className={`group glass-card border border-white/5 rounded-xl p-3 mb-2 cursor-grab active:cursor-grabbing transition-colors duration-200 select-none
              ${snapshot.isDragging ? 'border-white/20 shadow-lg shadow-black/20' : 'hover:border-white/10'}`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm text-white/95 font-medium leading-snug line-clamp-1 flex-1">
                {lead.nome}
              </p>
              {showSla ? (
                <SlaBadge startedAt={lead.atendimento_iniciado_em} />
              ) : created ? (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0">
                  <Clock className="w-3 h-3" />
                  {created}
                </span>
              ) : null}
            </div>

            {empresa && (
              <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-muted-foreground/80">
                <Building2 className="w-3 h-3" />
                <span className="truncate">{empresa}</span>
              </div>
            )}

            <div className="space-y-1 mb-2.5">
              {lead.email && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
              )}
              {lead.telefone && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span className="truncate">{lead.telefone}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
              <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">
                {lead.origem === 'inbound' || lead.origem === 'landing_page'
                  ? 'Inbound'
                  : lead.origem === 'outbound' || lead.origem === 'manual'
                    ? 'Outbound'
                    : lead.origem}
              </span>
              {responsavelNome ? (
                <span
                  className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold shrink-0"
                  style={{
                    width: 22,
                    height: 22,
                    background: tagColorFor(responsavelNome).bg,
                    color: tagColorFor(responsavelNome).fg,
                  }}
                  title={responsavelNome}
                >
                  {initialsOf(responsavelNome)}
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground/50 italic">Sem dono</span>
              )}
            </div>
          </div>
        );
        return snapshot.isDragging ? createPortal(child, document.body) : child;
      }}
    </Draggable>
  );
}
