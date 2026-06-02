import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  X, Check, CalendarPlus, CalendarClock, Type, AlignLeft, MapPin, Tag, Clock,
  Users as UsersIcon, Layers, UserCircle2, Crown, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { squadsApi } from '@/features/squads/api/squads.api';
import { calendarioApi } from '@/features/calendario/api/calendario.api';
import { queryKeys } from '@/entities/query-keys';
import { EVENT_TYPE_LIST, eventTypeConfig } from '@/features/calendario/lib/eventConfig';
import {
  toLocalDateTimeInput, toLocalDateInput, localDateTimeToISO, localDateToISO,
} from '@/features/calendario/lib/datetime';

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Todos no dashboard', icon: UsersIcon },
  { value: 'clevel', label: 'Somente C-levels', icon: Crown },
  { value: 'squad', label: 'Um squad', icon: Layers },
  { value: 'user', label: 'Pessoas específicas', icon: UserCircle2 },
];

const TITLE_MAX = 140;
const DESC_MAX = 1000;

function FieldLabel({ icon: Icon, children, required }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
      {required && <span className="text-[#EA3935]">*</span>}
    </label>
  );
}

// Defaults: início na data sugerida (ou agora arredondado) e fim 1h depois.
function buildInitialState(event, initialDate) {
  if (event) {
    const start = new Date(event.start_at);
    const end = new Date(event.end_at);
    return {
      title: event.title ?? '',
      type: event.type ?? 'meeting',
      all_day: !!event.all_day,
      startDateTime: toLocalDateTimeInput(start),
      endDateTime: toLocalDateTimeInput(end),
      startDate: toLocalDateInput(start),
      endDate: toLocalDateInput(end),
      location: event.location ?? '',
      description: event.description ?? '',
      audience_type: event.audience_type ?? 'all',
      squad_id: event.squad_id ?? '',
      assignee_ids: Array.isArray(event.attendees) && event.attendees.length
        ? event.attendees.map((a) => a.profile_id)
        : (event.assignee_id ? [event.assignee_id] : []),
    };
  }
  const base = initialDate ? new Date(initialDate) : new Date();
  if (!initialDate) base.setMinutes(0, 0, 0);
  base.setHours(base.getHours() < 23 ? Math.max(base.getHours(), 9) : 9);
  const end = new Date(base);
  end.setHours(end.getHours() + 1);
  return {
    title: '',
    type: 'meeting',
    all_day: false,
    startDateTime: toLocalDateTimeInput(base),
    endDateTime: toLocalDateTimeInput(end),
    startDate: toLocalDateInput(base),
    endDate: toLocalDateInput(base),
    location: '',
    description: '',
    audience_type: 'all',
    squad_id: '',
    assignee_ids: [],
  };
}

export default function EventoForm({ onClose, onSave, event, initialDate, isSaving }) {
  const isEdit = !!event;
  const [form, setForm] = useState(() => buildInitialState(event, initialDate));
  const [submitted, setSubmitted] = useState(false);
  const [erroData, setErroData] = useState('');
  const [peopleSearch, setPeopleSearch] = useState('');
  const titleRef = useRef(null);

  const { data: squads = [] } = useQuery({
    queryKey: queryKeys.squads.all,
    queryFn: squadsApi.list,
  });
  const { data: people = [] } = useQuery({
    queryKey: queryKeys.calendario.people,
    queryFn: calendarioApi.listPeople,
  });

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const titleTrim = form.title.trim();
  const titleInvalid = submitted && !titleTrim;
  const typeCfg = eventTypeConfig(form.type);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setSubmitted(true);
    setErroData('');
    if (!titleTrim) return;

    let start_at;
    let end_at;
    if (form.all_day) {
      if (!form.startDate || !form.endDate) {
        setErroData('Informe as datas.');
        return;
      }
      start_at = localDateToISO(form.startDate, 0, 0);
      end_at = localDateToISO(form.endDate, 23, 59);
    } else {
      if (!form.startDateTime || !form.endDateTime) {
        setErroData('Informe data e hora de início e fim.');
        return;
      }
      start_at = localDateTimeToISO(form.startDateTime);
      end_at = localDateTimeToISO(form.endDateTime);
    }

    if (new Date(end_at) < new Date(start_at)) {
      setErroData('O fim não pode ser antes do início.');
      return;
    }

    if (form.audience_type === 'squad' && !form.squad_id) {
      setErroData('Selecione o squad.');
      return;
    }
    if (form.audience_type === 'user' && form.assignee_ids.length === 0) {
      setErroData('Selecione pelo menos uma pessoa.');
      return;
    }

    onSave({
      title: titleTrim,
      type: form.type,
      all_day: form.all_day,
      location: form.location,
      description: form.description,
      start_at,
      end_at,
      audience_type: form.audience_type,
      squad_id: form.squad_id,
      assignee_ids: form.assignee_ids,
    });
  };

  const togglePerson = (id) =>
    setForm((f) => ({
      ...f,
      assignee_ids: f.assignee_ids.includes(id)
        ? f.assignee_ids.filter((x) => x !== id)
        : [...f.assignee_ids, id],
    }));

  const filteredPeople = people.filter((p) => {
    const q = peopleSearch.trim().toLowerCase();
    if (!q) return true;
    return (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative glass-card border border-white/10 rounded-2xl w-full max-w-lg z-10 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#EA3935]/10 flex items-center justify-center">
              {isEdit ? (
                <CalendarClock className="w-4 h-4 text-[#EA3935]" />
              ) : (
                <CalendarPlus className="w-4 h-4 text-[#EA3935]" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-tight">
                {isEdit ? 'Editar Evento' : 'Novo Evento'}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {isEdit ? 'Atualize os detalhes do evento' : 'Adicione um evento ao calendário'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <FieldLabel icon={Type} required>Título</FieldLabel>
            <Input
              ref={titleRef}
              placeholder="Ex.: Reunião de alinhamento"
              value={form.title}
              maxLength={TITLE_MAX}
              onChange={(e) => set({ title: e.target.value })}
              aria-invalid={titleInvalid}
              className={`bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10 transition-colors ${
                titleInvalid ? 'border-red-500/60 focus-visible:ring-red-500/30' : ''
              }`}
            />
            {titleInvalid && <p className="text-[11px] text-red-400 mt-1">Informe o título do evento.</p>}
          </div>

          <div>
            <FieldLabel icon={Tag}>Tipo</FieldLabel>
            <Select value={form.type} onValueChange={(v) => set({ type: v })}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                <SelectValue>
                  <span className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${typeCfg.dot}`} />
                    <span>{typeCfg.label}</span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                {EVENT_TYPE_LIST.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                      <span>{t.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel icon={UsersIcon}>Atribuir para</FieldLabel>
            <Select
              value={form.audience_type}
              onValueChange={(v) => set({ audience_type: v })}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                {AUDIENCE_OPTIONS.map((o) => {
                  const OptIcon = o.icon;
                  return (
                    <SelectItem key={o.value} value={o.value}>
                      <span className="flex items-center gap-2">
                        <OptIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        {o.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {form.audience_type === 'squad' && (
              <Select
                value={form.squad_id || ''}
                onValueChange={(v) => set({ squad_id: v })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10 mt-2">
                  <SelectValue placeholder="Selecionar squad" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  {squads.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum squad</div>
                  ) : (
                    squads.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}

            {form.audience_type === 'clevel' && (
              <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-300" /> Será atribuído a todos os C-levels (admin e head).
              </p>
            )}

            {form.audience_type === 'user' && (
              <div className="mt-2 space-y-2">
                {/* chips selecionados */}
                {form.assignee_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.assignee_ids.map((id) => {
                      const p = people.find((x) => x.id === id);
                      return (
                        <span key={id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#EA3935]/15 border border-[#EA3935]/30 text-[11px] text-white">
                          {p?.full_name || p?.email || 'Pessoa'}
                          <button type="button" onClick={() => togglePerson(id)} className="text-[#EA3935]/80 hover:text-white" aria-label="Remover">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {/* busca */}
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 h-10">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar pessoa..."
                    value={peopleSearch}
                    onChange={(e) => setPeopleSearch(e.target.value)}
                    className="bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none flex-1"
                  />
                </div>
                {/* lista com checkbox */}
                <div className="max-h-44 overflow-y-auto rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5">
                  {filteredPeople.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma pessoa encontrada.</div>
                  ) : (
                    filteredPeople.map((p) => {
                      const checked = form.assignee_ids.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePerson(p.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-[#EA3935] border-[#EA3935]' : 'border-white/20'}`}>
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <span className="text-sm text-white truncate">{p.full_name || p.email}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
            <span className="flex items-center gap-2 text-sm text-white">
              <Clock className="w-4 h-4 text-muted-foreground" /> Dia inteiro
            </span>
            <input
              type="checkbox"
              checked={form.all_day}
              onChange={(e) => set({ all_day: e.target.checked })}
              className="h-4 w-4 accent-[#EA3935]"
            />
          </label>

          {form.all_day ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>Início</FieldLabel>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set({ startDate: e.target.value, endDate: form.endDate < e.target.value ? e.target.value : form.endDate })}
                  className="bg-white/5 border-white/10 text-white h-10 [color-scheme:dark]"
                />
              </div>
              <div>
                <FieldLabel required>Fim</FieldLabel>
                <Input
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => set({ endDate: e.target.value })}
                  className="bg-white/5 border-white/10 text-white h-10 [color-scheme:dark]"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel required>Início</FieldLabel>
                <Input
                  type="datetime-local"
                  value={form.startDateTime}
                  onChange={(e) => set({ startDateTime: e.target.value, endDateTime: form.endDateTime < e.target.value ? e.target.value : form.endDateTime })}
                  className="bg-white/5 border-white/10 text-white h-10 [color-scheme:dark]"
                />
              </div>
              <div>
                <FieldLabel required>Fim</FieldLabel>
                <Input
                  type="datetime-local"
                  value={form.endDateTime}
                  min={form.startDateTime}
                  onChange={(e) => set({ endDateTime: e.target.value })}
                  className="bg-white/5 border-white/10 text-white h-10 [color-scheme:dark]"
                />
              </div>
            </div>
          )}
          {erroData && <p className="text-[11px] text-red-400 -mt-2">{erroData}</p>}

          <div>
            <FieldLabel icon={MapPin}>Local</FieldLabel>
            <Input
              placeholder="Sala, link da call, endereço..."
              value={form.location}
              onChange={(e) => set({ location: e.target.value })}
              className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10"
            />
          </div>

          <div>
            <FieldLabel icon={AlignLeft}>Descrição</FieldLabel>
            <Textarea
              placeholder="Pauta, contexto, observações..."
              value={form.description}
              maxLength={DESC_MAX}
              onChange={(e) => set({ description: e.target.value })}
              className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 min-h-[80px] resize-none"
            />
            <p className="text-[10px] text-muted-foreground/70 text-right mt-1">
              {form.description.length}/{DESC_MAX}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 pb-5 pt-1">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="flex-1 border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-white h-10"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4 mr-1.5" /> {isEdit ? 'Salvar alterações' : 'Criar evento'}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
