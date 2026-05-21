import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Mail, Phone, Building2, Sparkles, Target, User, Trash2, Loader2, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const statusOptions = [
  { value: 'pendente', label: 'Pendente', dot: 'bg-slate-400', color: 'text-slate-300' },
  { value: 'em_atendimento', label: 'Em Atendimento', dot: 'bg-blue-400', color: 'text-blue-300' },
  { value: 'follow_up', label: 'Follow Up', dot: 'bg-yellow-400', color: 'text-yellow-300' },
  { value: 'reuniao_marcada', label: 'Reunião Marcada', dot: 'bg-emerald-400', color: 'text-emerald-300' },
];

function FieldLabel({ icon: Icon, children }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </label>
  );
}

function ReadOnlyBlock({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div>
      <FieldLabel icon={Icon}>{label}</FieldLabel>
      <p className="text-sm text-white/90 bg-white/5 border border-white/5 rounded-lg px-3 py-2 whitespace-pre-wrap">
        {value}
      </p>
    </div>
  );
}

export default function LeadDetalheModal({
  lead,
  responsaveis = [],
  isAdmin = false,
  currentUser = null,
  isSubmitting = false,
  onClose,
  onSave,
  onDelete,
}) {
  const [form, setForm] = useState({
    status: lead.status,
    responsavel_id: lead.responsavel_id || '',
    notas: lead.notas || '',
  });

  const canEdit =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'closer' ||
    ((currentUser?.role === 'sdr' || currentUser?.role === 'bdr') &&
      (lead.status === 'pendente' || lead.responsavel_id === currentUser.id));

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    onSave({
      status: form.status,
      responsavel_id: form.responsavel_id || null,
      notas: form.notas,
    });
  };

  const dirty =
    form.status !== lead.status ||
    (form.responsavel_id || '') !== (lead.responsavel_id || '') ||
    (form.notas || '') !== (lead.notas || '');

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative glass-card border border-white/10 rounded-2xl w-full max-w-xl z-10 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#EA3935]/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-[#EA3935]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white leading-tight truncate">
                {lead.nome}
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">
                {lead.empresa || 'Sem empresa informada'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Excluir este lead? Esta ação não pode ser desfeita.')) {
                    onDelete(lead.id);
                  }
                }}
                className="flex items-center gap-1.5 p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs"
                aria-label="Excluir lead"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lead.email && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 border border-white/5 rounded-lg px-3 py-2">
                <Mail className="w-3.5 h-3.5 shrink-0 text-[#EA3935]" />
                <span className="truncate text-white/90">{lead.email}</span>
              </div>
            )}
            {lead.telefone && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/5 border border-white/5 rounded-lg px-3 py-2">
                <Phone className="w-3.5 h-3.5 shrink-0 text-[#EA3935]" />
                <span className="truncate text-white/90">{lead.telefone}</span>
              </div>
            )}
          </div>

          <ReadOnlyBlock icon={Sparkles} label="Momento da Empresa" value={lead.momento_empresa} />
          <ReadOnlyBlock icon={Target} label="Objetivo Principal" value={lead.objetivo_principal} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel icon={Building2}>Status</FieldLabel>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                disabled={!canEdit}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 disabled:opacity-60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                        <span className={s.color}>{s.label}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <FieldLabel icon={User}>Responsável (SDR/BDR)</FieldLabel>
              <Select
                value={form.responsavel_id || 'none'}
                onValueChange={(v) => setForm((f) => ({ ...f, responsavel_id: v === 'none' ? '' : v }))}
                disabled={!canEdit}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 disabled:opacity-60">
                  <SelectValue placeholder="Sem responsável" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {responsaveis.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <FieldLabel>Notas internas</FieldLabel>
            <Textarea
              placeholder="Anotações do closer, próximos passos, contexto..."
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              disabled={!canEdit}
              className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 min-h-[90px] resize-none disabled:opacity-60"
            />
          </div>

          {!canEdit && (
            <p className="text-[11px] text-muted-foreground/80 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
              Você só pode editar leads pendentes ou nos quais já é responsavel.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 pb-5 pt-1">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="flex-1 border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-white h-10"
          >
            Fechar
          </Button>
          <Button
            type="submit"
            disabled={!dirty || isSubmitting || !canEdit}
            className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvando...</>
            ) : (
              <><Check className="w-4 h-4 mr-1.5" /> Salvar</>
            )}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
