import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const data = [
  { nome: 'Ana', tarefas: 24, color: '#EA3935' },
  { nome: 'Carlos', tarefas: 18, color: '#C12D29' },
  { nome: 'Mariana', tarefas: 31, color: '#EA3935' },
  { nome: 'Lucas', tarefas: 14, color: '#C12D29' },
  { nome: 'Sofia', tarefas: 27, color: '#EA3935' },
  { nome: 'Pedro', tarefas: 22, color: '#C12D29' },
];

export default function TeamPerformance() {
  return (
    <div className="glass-card rounded-2xl p-5 border border-white/5">
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-white">Performance da Equipe</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Tarefas concluídas por membro</p>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} barSize={20}>
          <XAxis dataKey="nome" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={25} />
          <Tooltip
            contentStyle={{ background: 'rgba(15,14,26,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: 12 }}
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          />
          <Bar dataKey="tarefas" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}