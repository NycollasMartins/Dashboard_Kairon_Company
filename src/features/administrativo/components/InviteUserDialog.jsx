import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, User as UserIcon, Shield, Send, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { invitesApi } from '@/features/administrativo/api/invites.api';
import { roleConfig } from '@/features/administrativo/lib/roleConfig';
import { queryKeys } from '@/entities/query-keys';

const BRAND_FROM = '#EA3935';
const BRAND_TO = '#C12D29';

export default function InviteUserDialog({ open, onOpenChange }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('sdr');
  const [error, setError] = useState('');
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) {
      setEmail('');
      setFullName('');
      setRole('sdr');
      setError('');
    }
  }, [open]);

  const enviar = useMutation({
    mutationFn: invitesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.convitesPendentes.all });
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      toast({ title: 'Convite enviado!', description: `Um e-mail foi enviado para ${email}.` });
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err?.message || 'Não foi possível enviar o convite.');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !fullName.trim() || !role) return;
    enviar.mutate({
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f1a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Send className="w-4 h-4 text-[#EA3935]" />
            Convidar Usuário
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Envie um link por e-mail para a pessoa criar a senha e acessar o dashboard.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label htmlFor="invite-name" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <UserIcon className="w-3.5 h-3.5 text-zinc-400" /> Nome completo
            </label>
            <input
              id="invite-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="João da Silva"
              required
              autoComplete="name"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-[#EA3935]/35"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="invite-email" className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <Mail className="w-3.5 h-3.5 text-zinc-400" /> E-mail
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pessoa@empresa.com"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-[#EA3935]/35"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
              <Shield className="w-3.5 h-3.5 text-zinc-400" /> Permissão
            </label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a2e] border-white/10">
                {Object.entries(roleConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground pt-0.5">
              {roleConfig[role]?.desc}
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 flex items-start gap-2">
              <X className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={enviar.isPending}
              className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviar.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md shadow-[#EA3935]/25 transition-opacity disabled:opacity-60 hover:opacity-[0.97]"
              style={{
                background: enviar.isPending
                  ? 'rgba(234, 57, 53, 0.55)'
                  : `linear-gradient(135deg, ${BRAND_FROM}, ${BRAND_TO})`,
              }}
            >
              <Send className="w-3.5 h-3.5" />
              {enviar.isPending ? 'Enviando...' : 'Enviar Convite'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
