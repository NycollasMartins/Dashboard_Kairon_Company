import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { X, Check, Plus, User, Mail, Phone, Building2, FileText, Users, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { squadsApi } from '@/features/squads/api/squads.api';
import { queryKeys } from '@/entities/query-keys';

const ENTREGAVEIS_SUGERIDOS = [
  'Feed Instagram', 'Stories Instagram', 'Reels', 'Posts LinkedIn',
  'Gestão de Tráfego', 'Relatório Mensal', 'Email Marketing',
  'Copy para Anúncios', 'Identidade Visual', 'Landing Page',
];

const inputClass =
  'bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:border-[#EA3935]/50 focus:ring-[#EA3935]/20 h-10';

export default function ClienteForm({ onClose, onSave, cliente }) {
  const defaultForm = {
    nome: '', email: '', telefone: '', empresa: '',
    status: 'lead', squad_id: '', responsavel_id: '', entregaveis: [], notas: '',
  };

  const [form, setForm] = useState(() => {
    if (!cliente) return defaultForm;
    return {
      ...defaultForm,
      ...cliente,
      squad_id: cliente.squad_id ?? '',
      responsavel_id: cliente.responsavel_id ?? '',
      entregaveis: cliente.entregaveis ?? [],
    };
  });
  const [novoEntregavel, setNovoEntregavel] = useState('');

  const { data: squads = [] } = useQuery({
    queryKey: queryKeys.squads.all,
    queryFn: squadsApi.list,
  });

  const selectedSquad = squads.find((s) => s.id === form.squad_id);
  const membros = selectedSquad?.squad_membros?.map((sm) => sm.profiles).filter(Boolean) ?? [];

  const addEntregavel = (valor) => {
    const v = valor.trim();
    if (!v || form.entregaveis.includes(v)) return;
    setForm((f) => ({ ...f, entregaveis: [...f.entregaveis, v] }));
    setNovoEntregavel('');
  };

  const removeEntregavel = (item) => {
    setForm((f) => ({ ...f, entregaveis: f.entregaveis.filter((e) => e !== item) }));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addEntregavel(novoEntregavel); }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative glass-card border border-white/10 rounded-2xl w-full max-w-2xl z-10 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-7 py-5 border-b border-white/5">
          <div>
            <h3 className="text-base font-semibold text-white">{cliente ? 'Editar Cliente' : 'Novo Cliente'}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Preencha as informações do cliente</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-7 py-6 space-y-6">
          <section>
            <p className="text-xs font-semibold text-[#EA3935] uppercase tracking-wider mb-3 flex items-center gap-2">
              <User className="w-3.5 h-3.5" /> Informações Básicas
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Input
                  placeholder="Nome completo *"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-md px-3 h-10 focus-within:border-[#EA3935]/50">
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  placeholder="Empresa"
                  value={form.empresa}
                  onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                  className="bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none flex-1"
                />
              </div>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className={inputClass}><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="qualificado">Qualificado</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold text-[#EA3935] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> Contato
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-md px-3 h-10 focus-within:border-[#EA3935]/50">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none flex-1"
                />
              </div>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-md px-3 h-10 focus-within:border-[#EA3935]/50">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  placeholder="Telefone / WhatsApp"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  className="bg-transparent text-sm text-white placeholder:text-muted-foreground outline-none flex-1"
                />
              </div>
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold text-[#EA3935] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Users className="w-3.5 h-3.5" /> Squad Responsável
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                value={form.squad_id || 'none'}
                onValueChange={(v) => setForm({ ...form, squad_id: v === 'none' ? '' : v, responsavel_id: '' })}
              >
                <SelectTrigger className={inputClass}><SelectValue placeholder="Selecionar squad..." /></SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  <SelectItem value="none">Nenhum squad</SelectItem>
                  {squads.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={form.responsavel_id || 'none'}
                onValueChange={(v) => setForm({ ...form, responsavel_id: v === 'none' ? '' : v })}
                disabled={membros.length === 0}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder={membros.length === 0 ? 'Selecione um squad primeiro' : 'Responsável...'} />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a2e] border-white/10">
                  <SelectItem value="none">Nenhum responsável</SelectItem>
                  {membros.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold text-[#EA3935] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Package className="w-3.5 h-3.5" /> Entregáveis
            </p>
            {form.entregaveis.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {form.entregaveis.map((e) => (
                  <span key={e} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EA3935]/15 border border-[#EA3935]/30 text-xs text-white">
                    {e}
                    <button onClick={() => removeEntregavel(e)} className="text-[#EA3935] hover:text-white transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 mb-3">
              <input
                placeholder="Adicionar entregável personalizado..."
                value={novoEntregavel}
                onChange={(e) => setNovoEntregavel(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 h-9 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-[#EA3935]/50"
              />
              <Button
                onClick={() => addEntregavel(novoEntregavel)}
                size="sm"
                className="bg-[#EA3935]/20 hover:bg-[#EA3935]/40 border border-[#EA3935]/30 text-[#EA3935] h-9 px-3"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ENTREGAVEIS_SUGERIDOS.filter((s) => !form.entregaveis.includes(s)).map((s) => (
                <button
                  key={s}
                  onClick={() => addEntregavel(s)}
                  className="px-2.5 py-1 rounded-lg text-xs border border-white/10 bg-white/5 text-muted-foreground hover:text-white hover:border-[#EA3935]/30 hover:bg-[#EA3935]/10 transition-all"
                >
                  + {s}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs font-semibold text-[#EA3935] uppercase tracking-wider mb-3 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Notas
            </p>
            <textarea
              placeholder="Observações, contexto, histórico..."
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground outline-none focus:border-[#EA3935]/50 resize-none"
            />
          </section>
        </div>

        <div className="flex gap-3 px-7 py-5 border-t border-white/5">
          <Button onClick={onClose} variant="outline" className="flex-1 border-white/10 text-muted-foreground hover:text-white">
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const { responsavel: _r, squads: _s, ...payload } = form;
              onSave(payload);
            }}
            disabled={!form.nome.trim()}
            className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white"
          >
            <Check className="w-4 h-4 mr-1.5" /> {cliente ? 'Atualizar' : 'Criar Cliente'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
