import { ShieldAlert } from 'lucide-react';

export default function RestrictedAccessCard({
  title = 'Acesso restrito',
  description = 'Seu perfil não tem acesso a esta seção.',
  Icon = ShieldAlert,
}) {
  return (
    <div className="glass-card border border-white/5 rounded-2xl p-10 flex flex-col items-center gap-3 text-center animate-fade-in">
      <div className="w-12 h-12 rounded-xl bg-[#EA3935]/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-[#EA3935]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}
