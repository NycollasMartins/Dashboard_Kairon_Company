import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const data = [
  { mes: 'Jan', leads: 32, conversoes: 8 },
  { mes: 'Fev', leads: 45, conversoes: 12 },
  { mes: 'Mar', leads: 38, conversoes: 10 },
  { mes: 'Abr', leads: 62, conversoes: 18 },
  { mes: 'Mai', leads: 55, conversoes: 15 },
  { mes: 'Jun', leads: 78, conversoes: 24 },
  { mes: 'Jul', leads: 90, conversoes: 28 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-card border border-white/10 rounded-xl p-3 text-xs">
        <p className="text-white font-medium mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function LeadsChart() {
  return (
    <div className="glass-card rounded-2xl p-5 border border-white/5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-white">Leads & Conversões</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Últimos 7 meses</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{background:'#EA3935'}} /> Leads</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{background:'#f0706c'}} /> Conversões</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EA3935" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#EA3935" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorConversoes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f0706c" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f0706c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={30} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="leads" name="Leads" stroke="#EA3935" strokeWidth={2} fill="url(#colorLeads)" />
          <Area type="monotone" dataKey="conversoes" name="Conversões" stroke="#f0706c" strokeWidth={2} fill="url(#colorConversoes)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}