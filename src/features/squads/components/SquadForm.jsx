import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SquadForm({ squad, usuarios, onClose, onSave }) {
  const [form, setForm] = useState({
    nome: squad?.nome || '',
    descricao: squad?.descricao || '',
    membros_ids: squad?.squad_membros?.map((sm) => sm.profile_id) || [],
  });

  const toggleMembro = (id) => {
    setForm((f) => ({
      ...f,
      membros_ids: f.membros_ids.includes(id)
        ? f.membros_ids.filter((m) => m !== id)
        : [...f.membros_ids, id],
    }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card border border-white/10 rounded-2xl p-6 w-full max-w-md z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">{squad ? 'Editar Squad' : 'Novo Squad'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <Input
            placeholder="Nome do squad"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
          />
          <Input
            placeholder="Descrição (opcional)"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            className="bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
          />

          <div>
            <p className="text-xs text-muted-foreground mb-2">Selecionar membros:</p>
            {usuarios.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum usuário cadastrado no sistema.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {usuarios.map((u) => {
                  const selecionado = form.membros_ids.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleMembro(u.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all border
                        ${selecionado
                          ? 'border-[#EA3935]/40 bg-[#EA3935]/10 text-white'
                          : 'border-white/5 bg-white/5 text-muted-foreground hover:text-white hover:bg-white/10'}`}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ background: selecionado ? 'rgba(234, 57, 53,0.3)' : 'rgba(255,255,255,0.08)' }}
                      >
                        {u.full_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-xs font-medium">{u.full_name || u.email}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                      {selecionado && <Check className="w-3.5 h-3.5 text-[#EA3935]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={onClose} variant="outline" className="flex-1 border-white/10 text-muted-foreground hover:text-white">Cancelar</Button>
            <Button
              onClick={() => onSave(form)}
              disabled={!form.nome.trim()}
              className="flex-1 bg-[#EA3935] hover:bg-[#C12D29] border-0 text-white"
            >
              <Check className="w-4 h-4 mr-1" /> Salvar
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
