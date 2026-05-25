import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Check, Loader2, Sparkles, Mail, Phone, Building2, Target, User, AlignLeft, DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  MOMENTO_EMPRESA_OPTIONS, FATURAMENTO_MENSAL_OPTIONS,
} from '../constants/leadOptions';

const NOME_MAX = 120;

function FieldLabel({ icon: Icon, children, required }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
      {Icon && <Icon className="w-3 h-3" />}
      {children}
      {required && <span className="text-[#EA3935]">*</span>}
    </label>
  );
}

export default function LeadNovoModal({ isSubmitting = false, onClose, onSave }) {
  const [form, setForm] = useState({
    nome: '',
    empresa: '',
    email: '',
    telefone: '',
    momento_empresa: '',
    faturamento_mensal: '',
    objetivo_principal: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const nomeRef = useRef(null);

  useEffect(() => {
    nomeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const nomeTrim = form.nome.trim();
  const nomeInvalid = submitted && !nomeTrim;
  const canSubmit = nomeTrim.length > 0 && !isSubmitting;

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setSubmitted(true);
    if (!canSubmit) return;
    onSave({ ...form, nome: nomeTrim, origem: 'manual' });
  };

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
              <Sparkles className="w-4 h-4 text-[#EA3935]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white leading-tight">Novo Lead</h3>
              <p className="text-[11px] text-muted-foreground">
                Cadastro manual — entra no funil como pendente
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
            <FieldLabel icon={User} required>Nome</FieldLabel>
            <Input
              ref={nomeRef}
              placeholder="Ex.: Maria Souza"
              value={form.nome}
              maxLength={NOME_MAX}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              aria-invalid={nomeInvalid}
              className={`bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10 ${
                nomeInvalid ? 'border-red-500/60 focus-visible:ring-red-500/30' : ''
              }`}
            />
            {nomeInvalid && (
              <p className="text-[11px] text-red-400 mt-1">Informe o nome do lead.</p>
            )}
          </div>

          <div>
            <FieldLabel icon={Building2}>Empresa</FieldLabel>
            <Input
              placeholder="Empresa ou organização"
              value={form.empresa}
              onChange={(e) => setForm({ ...form, empresa: e.target.value })}
              className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel icon={Mail}>Email</FieldLabel>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10"
              />
            </div>
            <div>
              <FieldLabel icon={Phone}>Telefone</FieldLabel>
              <Input
                placeholder="(11) 99999-9999"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel icon={AlignLeft}>Momento da empresa</FieldLabel>
              <Select
                value={form.momento_empresa || undefined}
                onValueChange={(v) => setForm({ ...form, momento_empresa: v })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  {MOMENTO_EMPRESA_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <FieldLabel icon={DollarSign}>Faturamento mensal</FieldLabel>
              <Select
                value={form.faturamento_mensal || undefined}
                onValueChange={(v) => setForm({ ...form, faturamento_mensal: v })}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  {FATURAMENTO_MENSAL_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <FieldLabel icon={Target}>Objetivo principal</FieldLabel>
            <Textarea
              placeholder="O que esse lead quer alcançar"
              value={form.objetivo_principal}
              onChange={(e) => setForm({ ...form, objetivo_principal: e.target.value })}
              className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 min-h-[70px] resize-none"
            />
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
            disabled={!canSubmit}
            className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white h-10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Criando...</>
            ) : (
              <><Check className="w-4 h-4 mr-1.5" /> Criar lead</>
            )}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
