import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { usersApi } from '@/features/administrativo/api/users.api';
import { queryKeys } from '@/entities/query-keys';

export default function DeleteUserDialog({ open, onOpenChange, user }) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState('');
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    if (!open) {
      setConfirmEmail('');
      setError('');
    }
  }, [open]);

  const excluir = useMutation({
    mutationFn: () => usersApi.remove(user.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.usuarios.all });
      qc.invalidateQueries({ queryKey: queryKeys.convitesPendentes.all });
      toast({
        title: 'Usuário excluído.',
        description: `${user.full_name || user.email} foi removido permanentemente.`,
      });
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err?.message || 'Não foi possível excluir o usuário.');
    },
  });

  const targetEmail = (user?.email ?? '').toLowerCase();
  const canSubmit =
    !!targetEmail && confirmEmail.trim().toLowerCase() === targetEmail;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!canSubmit) return;
    excluir.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f0f1a] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            Excluir usuário permanentemente
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Esta ação é <strong className="text-red-300">irreversível</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-xs text-red-200 space-y-1.5">
          <p className="font-semibold text-red-200">O que acontece:</p>
          <ul className="list-disc list-inside space-y-0.5 text-red-200/90">
            <li>O acesso ao sistema é removido imediatamente.</li>
            <li>
              Clientes, tarefas, leads e contratos que esta pessoa era
              responsável <strong>perdem o responsável</strong> (ficam vazios).
            </li>
            <li>Memberships em squads são removidos.</li>
            <li>O histórico do que ela criou continua, mas sem nome.</li>
          </ul>
          <p className="pt-1 text-red-200/90">
            Se quer apenas tirar o acesso preservando o histórico,{' '}
            <strong>arquive</strong> em vez de excluir.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-email"
              className="text-xs font-semibold text-zinc-200"
            >
              Para confirmar, digite o e-mail:{' '}
              <span className="text-red-300">{targetEmail}</span>
            </label>
            <input
              id="confirm-email"
              type="text"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={targetEmail}
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-red-500/35"
            />
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
              disabled={excluir.isPending}
              className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-300 hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit || excluir.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow-md shadow-red-500/25 transition-opacity disabled:opacity-50 hover:opacity-[0.97]"
              style={{
                background:
                  !canSubmit || excluir.isPending
                    ? 'rgba(239, 68, 68, 0.45)'
                    : 'linear-gradient(135deg, #ef4444, #b91c1c)',
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {excluir.isPending ? 'Excluindo...' : 'Excluir definitivamente'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
