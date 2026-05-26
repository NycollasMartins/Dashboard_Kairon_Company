import { Crown, Briefcase, Edit2, User, UserCheck, Star, Palette, HeartHandshake } from 'lucide-react';

export const roleConfig = {
  admin: {
    label: 'Admin',
    icon: Crown,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    desc: 'Acesso total ao sistema',
  },
  head: {
    label: 'Head',
    icon: Star,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
    desc: 'Liderança com acesso ampliado',
  },
  'social media': {
    label: 'Social Media',
    icon: Briefcase,
    color: 'text-[#EA3935]',
    bg: 'bg-red-500/10 border-red-500/20',
    desc: 'Gestão de redes sociais',
  },
  editor: {
    label: 'Editor',
    icon: Edit2,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    desc: 'Edita apenas tarefas próprias',
  },
  designer: {
    label: 'Designer',
    icon: Palette,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/20',
    desc: 'Edita apenas tarefas próprias',
  },
  cs: {
    label: 'CS',
    icon: HeartHandshake,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    desc: 'Customer Success — operacional ampliado',
  },
  closer: {
    label: 'Closer',
    icon: User,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    desc: 'Fechamento de vendas',
  },
  sdr: {
    label: 'SDR',
    icon: UserCheck,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    desc: 'Prospecção e qualificação',
  },
  bdr: {
    label: 'BDR',
    icon: UserCheck,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    desc: 'Geração de demanda outbound',
  },
};

export const ROLE_KEYS = Object.keys(roleConfig);
