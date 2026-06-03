import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  X, Check, Plus, Mail, Phone, Building2, Users, Package,
  AlignLeft, UserPlus, Loader2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { squadsApi } from '@/features/squads/api/squads.api';
import { queryKeys } from '@/entities/query-keys';

const ENTREGAVEIS_SUGERIDOS = [
  'Feed Instagram', 'Stories Instagram', 'Reels', 'Posts LinkedIn',
  'Gestão de Tráfego', 'Relatório Mensal', 'Email Marketing',
  'Copy para Anúncios', 'Identidade Visual', 'Landing Page',
];

const NOME_MAX = 120;
const NOTAS_MAX = 500;

function FieldLabel({ icon: Icon, children, required }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
      {required && <span className="text-[#EA3935]">*</span>}
    </label>
  );
}

export default function ConverterLeadModal({
  lead,
  currentUser = null,
  isSubmitting = false,
  onClose,
  onConfirm,
}) {
  const isCloser = currentUser?.role === 'closer';
  const [form, setForm] = useState(() => ({
    nome: lead?.nome ?? '',
    empresa: lead?.empresa ?? '',
    email: lead?.email ?? '',
    telefone: lead?.telefone ?? '',
    squad_id: '',
    entregaveis: [],
    notas: lead?.notas ?? '',
  }));
  const [novoEntregavel, setNovoEntregavel] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: squads = [] } = useQuery({
    queryKey: queryKeys.squads.all,
    queryFn: squadsApi.list,
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addEntregavel = (valor) => {
    const v = valor.trim();
    if (!v || form.entregaveis.includes(v)) return;
    setForm((f) => ({ ...f, entregaveis: [...f.entregaveis, v] }));
    setNovoEntregavel('');
  };

  const removeEntregavel = (item) => {
    setForm((f) => ({ ...f, entregaveis: f.entregaveis.filter((e) => e !== item) }));
  };

  const handleEntregavelKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEntregavel(novoEntregavel);
    }
  };

  const nomeTrim = form.nome.trim();
  const nomeInvalid = submitted && !nomeTrim;
  const canSubmit = nomeTrim.length > 0 && !isSubmitting;

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setSubmitted(true);
    if (!nomeTrim) return;
    onConfirm({
      nome: nomeTrim,
      empresa: form.empresa.trim(),
      email: form.email.trim(),
      telefone: form.telefone.trim(),
      squad_id: form.squad_id || null,
      entregaveis: form.entregaveis,
      notas: form.notas.trim(),
    });
  };

  const sugestoesDisponiveis = ENTREGAVEIS_SUGERIDOS.filter(
    (s) => !form.entregaveis.includes(s)
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative glass-card border border-emerald-500/20 rounded-2xl w-full max-w-lg z-10 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-tight">
                Converter Lead em Cliente
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Os dados do lead serão usados para criar o cliente.
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
          <div className="flex items-start gap-2 text-[11px] text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Esta ação cria um novo Cliente e vincula o Lead a ele.
              O Lead sairá do kanban e um projeto <strong>Onboarding</strong> será criado automaticamente.
              {isCloser && ' Você ficará como responsável (closer) desta venda — ela entra no seu ranking quando o contrato for criado.'}
            </span>
          </div>

          <div>
            <FieldLabel required>Nome</FieldLabel>
            <Input
              placeholder="Nome do cliente"
              value={form.nome}
              maxLength={NOME_MAX}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              aria-invalid={nomeInvalid}
              className={`bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10 transition-colors ${
                nomeInvalid ? 'border-red-500/60 focus-visible:ring-red-500/30' : ''
              }`}
            />
            {nomeInvalid && (
              <p className="text-[11px] text-red-400 mt-1">Informe o nome do cliente.</p>
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

          <div className="grid grid-cols-2 gap-3">
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

          <div>
            <FieldLabel icon={Users}>Squad responsável</FieldLabel>
            <Select
              value={form.squad_id || 'none'}
              onValueChange={(v) => setForm({ ...form, squad_id: v === 'none' ? '' : v })}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white h-10">
                <SelectValue placeholder="Selecionar squad" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10 z-[70]">
                <SelectItem value="none">Sem squad</SelectItem>
                {squads.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <FieldLabel icon={Package}>Entregáveis</FieldLabel>
            {form.entregaveis.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.entregaveis.map((e) => (
                  <span
                    key={e}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EA3935]/15 border border-[#EA3935]/30 text-[11px] text-white"
                  >
                    {e}
                    <button
                      type="button"
                      onClick={() => removeEntregavel(e)}
                      className="text-[#EA3935]/80 hover:text-white transition-colors"
                      aria-label={`Remover ${e}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar entregável..."
                value={novoEntregavel}
                onChange={(e) => setNovoEntregavel(e.target.value)}
                onKeyDown={handleEntregavelKey}
                className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10 flex-1"
              />
              <Button
                type="button"
                onClick={() => addEntregavel(novoEntregavel)}
                disabled={!novoEntregavel.trim()}
                className="bg-[#EA3935]/15 hover:bg-[#EA3935]/25 border border-[#EA3935]/30 text-[#EA3935] h-10 px-3 disabled:opacity-40"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {sugestoesDisponiveis.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {sugestoesDisponiveis.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addEntregavel(s)}
                    className="px-2 py-0.5 rounded-md text-[11px] border border-white/10 bg-white/5 text-muted-foreground hover:text-white hover:border-[#EA3935]/30 hover:bg-[#EA3935]/10 transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <FieldLabel icon={AlignLeft}>Notas</FieldLabel>
            <Textarea
              placeholder="Observações, contexto, histórico..."
              value={form.notas}
              maxLength={NOTAS_MAX}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 min-h-[80px] resize-none"
            />
            <p className="text-[10px] text-muted-foreground/70 text-right mt-1">
              {form.notas.length}/{NOTAS_MAX}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 pb-5 pt-1">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            disabled={isSubmitting}
            className="flex-1 border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-white h-10"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 border-0 text-white h-10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Criando...</>
            ) : (
              <><Check className="w-4 h-4 mr-1.5" /> Criar Cliente</>
            )}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
