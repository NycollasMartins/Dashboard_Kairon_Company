import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  X, Check, Plus, Coins, Calendar, Clock, Package, AlignLeft,
  FileText, Loader2, User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { metasApi } from '@/features/metas/api/metas.api';
import { queryKeys } from '@/entities/query-keys';
import { formatDateBR } from '../utils/contrato.format';

const SEM_RESPONSAVEL = '__none__';

const ENTREGAVEIS_SUGERIDOS = [
  'Feed Instagram', 'Stories Instagram', 'Reels', 'Posts LinkedIn',
  'Gestão de Tráfego', 'Relatório Mensal', 'Email Marketing',
  'Copy para Anúncios', 'Identidade Visual', 'Landing Page',
];

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

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeDataFim(inicioISO, meses) {
  if (!inicioISO || !meses || meses <= 0) return null;
  const [y, m, d] = inicioISO.split('-').map(Number);
  if (!y || !m || !d) return null;
  const start = new Date(Date.UTC(y, m - 1, d));
  start.setUTCMonth(start.getUTCMonth() + Number(meses));
  start.setUTCDate(start.getUTCDate() - 1);
  const yy = start.getUTCFullYear();
  const mm = String(start.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(start.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export default function ContratoFormModal({
  isSubmitting = false,
  defaultCloserId = null,
  onClose,
  onConfirm,
}) {
  const { data: closers = [] } = useQuery({ queryKey: queryKeys.metas.closers, queryFn: metasApi.listClosers });
  const [form, setForm] = useState(() => ({
    tipo: 'MRR',
    valor: '',
    duracao_meses: '12',
    data_inicio: todayISO(),
    entregaveis: [],
    notas: '',
    closer_id: '',
  }));

  // Default "quem vendeu" = responsável do cliente, se for um closer.
  useEffect(() => {
    if (form.closer_id) return;
    if (defaultCloserId && closers.some((c) => c.id === defaultCloserId)) {
      setForm((f) => ({ ...f, closer_id: defaultCloserId }));
    } else if (closers.length > 0) {
      setForm((f) => ({ ...f, closer_id: SEM_RESPONSAVEL }));
    }
  }, [closers, defaultCloserId, form.closer_id]);
  const [novoEntregavel, setNovoEntregavel] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valorNum = Number(form.valor);
  const duracaoNum = Number(form.duracao_meses);
  const valorInvalid = submitted && (!Number.isFinite(valorNum) || valorNum <= 0);
  const duracaoInvalid = submitted && (!Number.isInteger(duracaoNum) || duracaoNum <= 0);
  const inicioInvalid = submitted && !form.data_inicio;

  const dataFimPreview = useMemo(
    () => computeDataFim(form.data_inicio, duracaoNum),
    [form.data_inicio, duracaoNum]
  );

  const addEntregavel = (valor) => {
    const v = (valor ?? '').trim();
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

  const canSubmit =
    Number.isFinite(valorNum) && valorNum > 0 &&
    Number.isInteger(duracaoNum) && duracaoNum > 0 &&
    !!form.data_inicio && !isSubmitting;

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setSubmitted(true);
    if (!canSubmit) return;
    onConfirm({
      tipo: form.tipo,
      valor: valorNum,
      duracao_meses: duracaoNum,
      data_inicio: form.data_inicio,
      entregaveis: form.entregaveis,
      notas: form.notas.trim(),
      closer_id: form.closer_id === SEM_RESPONSAVEL ? null : (form.closer_id || null),
    });
  };

  const sugestoesDisponiveis = ENTREGAVEIS_SUGERIDOS.filter(
    (s) => !form.entregaveis.includes(s)
  );

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
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#EA3935]/15">
              <FileText className="w-4 h-4 text-[#EA3935]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-tight">
                Novo contrato
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Defina o formato, valor e vigência do contrato.
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
            <FieldLabel required>Formato do contrato</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'MRR', label: 'MRR', hint: 'Mensalidade recorrente' },
                { value: 'TCV', label: 'TCV', hint: 'Valor total único' },
              ].map((opt) => {
                const active = form.tipo === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tipo: opt.value }))}
                    className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                      active
                        ? 'bg-[#EA3935]/15 border-[#EA3935]/40 text-white'
                        : 'bg-white/5 border-white/10 text-muted-foreground hover:text-white hover:border-white/20'
                    }`}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">{opt.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel icon={Coins} required>
                Valor {form.tipo === 'MRR' ? '(mensal)' : '(total)'}
              </FieldLabel>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                aria-invalid={valorInvalid}
                className={`bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10 ${
                  valorInvalid ? 'border-red-500/60 focus-visible:ring-red-500/30' : ''
                }`}
              />
              {valorInvalid && (
                <p className="text-[11px] text-red-400 mt-1">Informe um valor maior que zero.</p>
              )}
            </div>
            <div>
              <FieldLabel icon={Clock} required>Duração (meses)</FieldLabel>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="12"
                value={form.duracao_meses}
                onChange={(e) => setForm({ ...form, duracao_meses: e.target.value })}
                aria-invalid={duracaoInvalid}
                className={`bg-white/5 border-white/10 text-white placeholder:text-muted-foreground/70 h-10 ${
                  duracaoInvalid ? 'border-red-500/60 focus-visible:ring-red-500/30' : ''
                }`}
              />
              {duracaoInvalid && (
                <p className="text-[11px] text-red-400 mt-1">Informe a duração em meses.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel icon={Calendar} required>Data de início</FieldLabel>
              <Input
                type="date"
                value={form.data_inicio}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                aria-invalid={inicioInvalid}
                className={`bg-white/5 border-white/10 text-white h-10 ${
                  inicioInvalid ? 'border-red-500/60 focus-visible:ring-red-500/30' : ''
                }`}
              />
            </div>
            <div>
              <FieldLabel icon={Calendar}>Encerra em</FieldLabel>
              <div className="bg-white/[0.03] border border-white/10 rounded-md h-10 px-3 flex items-center text-sm text-white/80">
                {dataFimPreview ? formatDateBR(dataFimPreview) : '—'}
              </div>
            </div>
          </div>

          <div>
            <FieldLabel icon={User} required>Quem vendeu</FieldLabel>
            <select
              value={form.closer_id || SEM_RESPONSAVEL}
              onChange={(e) => setForm((f) => ({ ...f, closer_id: e.target.value }))}
              className="w-full h-10 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#EA3935]"
            >
              <option value={SEM_RESPONSAVEL} className="bg-[#1a1a2e]">Sem responsável (venda do admin)</option>
              {closers.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#1a1a2e]">{c.full_name || c.email}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              {form.closer_id && form.closer_id !== SEM_RESPONSAVEL
                ? 'Conta na meta do mês, no ranking e nas vendas do mês do closer.'
                : 'Conta só na meta do mês (sem ranking / sem vendas do mês).'}
            </p>
          </div>

          <div>
            <FieldLabel icon={Package}>Entregáveis do contrato</FieldLabel>
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
              placeholder="Observações sobre o contrato, condições especiais, contexto..."
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
            className="flex-1 border-0 text-white h-10 disabled:opacity-50 disabled:cursor-not-allowed bg-[#EA3935] hover:bg-[#C12D29]"
          >
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Criando...</>
            ) : (
              <><Check className="w-4 h-4 mr-1.5" /> Criar contrato</>
            )}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
