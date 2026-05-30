import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Check,
  Megaphone,
  Sparkles,
  Target,
  DollarSign,
  CalendarRange,
  Users,
  Layers,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  PLATFORM_OPTIONS,
  OBJECTIVE_OPTIONS,
  BUDGET_TYPE_OPTIONS,
  platformConfig,
} from '@/features/campanhas/constants/campaignOptions';

const NOME_MAX = 120;

function FieldLabel({ icon: Icon, children, required }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
      {required && <span className="text-[#EA3935]">*</span>}
    </label>
  );
}

export default function CampanhaForm({ onClose, onSave, campanha, isSaving = false }) {
  const isEdit = !!campanha;
  const audience = campanha?.audience ?? {};

  const [form, setForm] = useState(() => ({
    name: campanha?.name ?? '',
    platform: campanha?.platform ?? 'meta',
    objective: campanha?.objective ?? '',
    budget: campanha?.budget != null ? String(campanha.budget) : '',
    budget_type: campanha?.budget_type ?? 'daily',
    start_date: campanha?.start_date ?? '',
    end_date: campanha?.end_date ?? '',
    audience_locations: audience.locations ?? '',
    audience_age: audience.age ?? '',
    audience_interests: audience.interests ?? '',
  }));
  const [submitted, setSubmitted] = useState(false);
  const nomeRef = useRef(null);

  useEffect(() => {
    nomeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const nomeTrim = form.name.trim();
  const nomeInvalid = submitted && !nomeTrim;
  const datasInvalid =
    submitted && form.start_date && form.end_date && form.end_date < form.start_date;
  const canSubmit = nomeTrim.length > 0 && !!form.platform;

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setSubmitted(true);
    if (!canSubmit || datasInvalid) return;

    const audiencePayload = {};
    if (form.audience_locations.trim()) audiencePayload.locations = form.audience_locations.trim();
    if (form.audience_age.trim()) audiencePayload.age = form.audience_age.trim();
    if (form.audience_interests.trim()) audiencePayload.interests = form.audience_interests.trim();

    onSave({
      name: nomeTrim,
      platform: form.platform,
      objective: form.objective || null,
      budget: form.budget === '' ? null : Number(form.budget),
      budget_type: form.budget_type,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      audience: audiencePayload,
    });
  };

  const plat = platformConfig[form.platform] ?? platformConfig.meta;

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
                <Megaphone className="w-4 h-4 text-[#EA3935]" />
              ) : (
                <Sparkles className="w-4 h-4 text-[#EA3935]" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-tight">
                {isEdit ? 'Editar Campanha' : 'Nova Campanha'}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {isEdit ? 'Atualize os dados da campanha' : `Cadastre uma campanha de ${plat.label}`}
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
            <FieldLabel required>Nome da campanha</FieldLabel>
            <Input
              ref={nomeRef}
              placeholder="Ex.: Black Friday - Conversão"
              value={form.name}
              maxLength={NOME_MAX}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-invalid={nomeInvalid}
              className={`bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10 transition-colors ${
                nomeInvalid ? 'border-red-500/60 focus-visible:ring-red-500/30' : ''
              }`}
            />
            {nomeInvalid && (
              <p className="text-[11px] text-red-400 mt-1">Informe o nome da campanha.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel icon={Layers} required>Plataforma</FieldLabel>
              <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  {PLATFORM_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel icon={Target}>Objetivo</FieldLabel>
              <Select
                value={form.objective || 'none'}
                onValueChange={(v) => setForm({ ...form, objective: v === 'none' ? '' : v })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  <SelectItem value="none">Sem objetivo</SelectItem>
                  {OBJECTIVE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel icon={DollarSign}>Orçamento (R$)</FieldLabel>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10"
              />
            </div>
            <div>
              <FieldLabel icon={Flag}>Tipo de orçamento</FieldLabel>
              <Select value={form.budget_type} onValueChange={(v) => setForm({ ...form, budget_type: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  {BUDGET_TYPE_OPTIONS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel icon={CalendarRange}>Início</FieldLabel>
              <Input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-10 [color-scheme:dark]"
              />
            </div>
            <div>
              <FieldLabel icon={CalendarRange}>Fim</FieldLabel>
              <Input
                type="date"
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                aria-invalid={!!datasInvalid}
                className={`bg-white/5 border-white/10 text-white h-10 [color-scheme:dark] ${
                  datasInvalid ? 'border-red-500/60' : ''
                }`}
              />
            </div>
          </div>
          {datasInvalid && (
            <p className="text-[11px] text-red-400 -mt-2">A data de fim deve ser igual ou posterior ao início.</p>
          )}

          <div className="pt-1">
            <FieldLabel icon={Users}>Segmentação (básica)</FieldLabel>
            <div className="space-y-2">
              <Input
                placeholder="Localização (ex.: São Paulo, Brasil)"
                value={form.audience_locations}
                onChange={(e) => setForm({ ...form, audience_locations: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10"
              />
              <Input
                placeholder="Faixa etária (ex.: 25-45)"
                value={form.audience_age}
                onChange={(e) => setForm({ ...form, audience_age: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10"
              />
              <Textarea
                placeholder="Interesses / palavras-chave (ex.: marketing, e-commerce, gestão)"
                value={form.audience_interests}
                onChange={(e) => setForm({ ...form, audience_interests: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 min-h-[64px] resize-none"
              />
            </div>
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
            disabled={!canSubmit || isSaving}
            className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4 mr-1.5" /> {isEdit ? 'Salvar alterações' : 'Criar campanha'}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
