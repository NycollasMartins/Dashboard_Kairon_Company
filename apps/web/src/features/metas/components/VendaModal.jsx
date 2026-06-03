import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Coins, User, Calendar, Building2, Loader2, BadgeDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatBRL } from '@/features/clientes/utils/contrato.format';

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function FieldLabel({ icon: Icon, children, required }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
      {required && <span className="text-[#EA3935]">*</span>}
    </label>
  );
}

// Lança uma venda. Admin pode escolher o closer; closer lança em nome próprio.
export default function VendaModal({
  isAdmin = false,
  currentUser,
  closers = [],
  isSubmitting = false,
  onClose,
  onConfirm,
}) {
  const selfIsCloser = closers.some((c) => c.id === currentUser?.id);
  const [form, setForm] = useState(() => ({
    closer_id: isAdmin ? (closers[0]?.id ?? '') : (currentUser?.id ?? ''),
    valor: '',
    cliente_nome: '',
    data_venda: todayISO(),
  }));
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valorNum = Number(form.valor);
  const valorInvalid = submitted && (!Number.isFinite(valorNum) || valorNum <= 0);
  const closerInvalid = submitted && !form.closer_id;

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    setSubmitted(true);
    if (!form.closer_id || !Number.isFinite(valorNum) || valorNum <= 0) return;
    onConfirm({
      closer_id: form.closer_id,
      valor: valorNum,
      cliente_nome: form.cliente_nome,
      data_venda: form.data_venda,
    });
  };

  // Admin sem closers cadastrados: não há para quem atribuir.
  const semCloser = isAdmin && closers.length === 0;
  // Closer cujo papel não está na lista (ex.: admin que não é closer e não escolheu).
  const naoEhCloser = !isAdmin && !selfIsCloser;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        className="relative bg-[#15151c] border border-white/10 rounded-2xl w-full max-w-md z-10 shadow-2xl shadow-black/50"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#EA3935]/15">
              <BadgeDollarSign className="w-4 h-4 text-[#EA3935]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Registrar venda</h2>
              <p className="text-xs text-muted-foreground">A venda entra no ranking do mês.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-white hover:bg-white/5 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {semCloser && (
            <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              Nenhum closer cadastrado. Cadastre um usuário com papel "closer" para lançar vendas.
            </p>
          )}
          {naoEhCloser && (
            <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              Seu usuário não é closer. A venda será atribuída a você mesmo assim.
            </p>
          )}

          {/* Closer */}
          <div>
            <FieldLabel icon={User} required>Closer (quem vendeu)</FieldLabel>
            {isAdmin ? (
              <select
                value={form.closer_id}
                onChange={(e) => setForm((f) => ({ ...f, closer_id: e.target.value }))}
                className={`w-full h-10 rounded-lg bg-white/5 border px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#EA3935] ${closerInvalid ? 'border-[#EA3935]' : 'border-white/10'}`}
              >
                <option value="" disabled className="bg-[#15151c]">Selecione um closer</option>
                {closers.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#15151c]">{c.full_name || c.email}</option>
                ))}
              </select>
            ) : (
              <div className="w-full h-10 rounded-lg bg-white/5 border border-white/10 px-3 text-sm text-white flex items-center">
                {currentUser?.full_name || currentUser?.email || 'Você'}
              </div>
            )}
          </div>

          {/* Valor */}
          <div>
            <FieldLabel icon={Coins} required>Valor da venda (R$)</FieldLabel>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0,00"
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
              className={valorInvalid ? 'border-[#EA3935]' : ''}
            />
            {Number.isFinite(valorNum) && valorNum > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">{formatBRL(valorNum)}</p>
            )}
          </div>

          {/* Cliente / descrição */}
          <div>
            <FieldLabel icon={Building2}>Cliente / descrição (opcional)</FieldLabel>
            <Input
              type="text"
              placeholder="Ex.: Empresa X — plano anual"
              value={form.cliente_nome}
              onChange={(e) => setForm((f) => ({ ...f, cliente_nome: e.target.value }))}
            />
          </div>

          {/* Data */}
          <div>
            <FieldLabel icon={Calendar} required>Data da venda</FieldLabel>
            <Input
              type="date"
              value={form.data_venda}
              onChange={(e) => setForm((f) => ({ ...f, data_venda: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/5">
          <Button type="button" variant="outline" onClick={onClose} className="border-white/10 bg-transparent text-white hover:bg-white/5">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || semCloser} className="bg-[#EA3935] hover:bg-[#d32f2c] text-white">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar venda'}
          </Button>
        </div>
      </motion.form>
    </div>
  );
}
