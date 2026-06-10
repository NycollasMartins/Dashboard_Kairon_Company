import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const PALETA = ['#EA3935', '#34d399', '#60a5fa', '#a78bfa', '#f59e0b', '#22d3ee', '#f472b6', '#84cc16'];

const fmtNum = (v) => Number(v ?? 0).toLocaleString('pt-BR');

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card border border-white/10 rounded-xl p-2.5 text-xs">
      {label != null && <p className="text-white font-medium mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey ?? p.name} style={{ color: p.color || p.payload?.fill }}>
          {p.name}: {fmtNum(p.value)}
        </p>
      ))}
    </div>
  );
}

const eixo = { fontSize: 11, fill: '#6b7280' };

function Grafico({ block }) {
  const { chartType = 'bar', data = [], seriesLabels = {} } = block;
  const temValue2 = data.some((d) => d.value2 != null);
  const labelV = seriesLabels.value || 'Valor';
  const labelV2 = seriesLabels.value2 || 'Série 2';

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => e.name}>
            {data.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
      <XAxis dataKey="name" tick={eixo} axisLine={false} tickLine={false} />
      <YAxis tick={eixo} axisLine={false} tickLine={false} width={52} tickFormatter={fmtNum} />
      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
      {temValue2 && <Legend wrapperStyle={{ fontSize: 11 }} />}
    </>
  );

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          {common}
          <Line type="monotone" dataKey="value" name={labelV} stroke={PALETA[0]} strokeWidth={2} dot={false} />
          {temValue2 && <Line type="monotone" dataKey="value2" name={labelV2} stroke={PALETA[2]} strokeWidth={2} dot={false} />}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'area') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="rep-grad-1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PALETA[1]} stopOpacity={0.4} />
              <stop offset="95%" stopColor={PALETA[1]} stopOpacity={0} />
            </linearGradient>
          </defs>
          {common}
          <Area type="monotone" dataKey="value" name={labelV} stroke={PALETA[1]} strokeWidth={2} fill="url(#rep-grad-1)" />
          {temValue2 && <Area type="monotone" dataKey="value2" name={labelV2} stroke={PALETA[0]} strokeWidth={2} fillOpacity={0} />}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // default: bar
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        {common}
        <Bar dataKey="value" name={labelV} fill={PALETA[0]} radius={[6, 6, 0, 0]} />
        {temValue2 && <Bar dataKey="value2" name={labelV2} fill={PALETA[2]} radius={[6, 6, 0, 0]} />}
      </BarChart>
    </ResponsiveContainer>
  );
}

function Bloco({ block }) {
  switch (block?.type) {
    case 'heading':
      return block.level === 2 ? (
        <h3 className="text-base font-semibold text-white mt-2">{block.text}</h3>
      ) : (
        <h2 className="text-xl font-bold text-white tracking-tight border-b border-white/10 pb-2 mt-4">{block.text}</h2>
      );

    case 'paragraph':
      return <p className="text-sm text-white/80 leading-relaxed">{block.text}</p>;

    case 'kpis':
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(block.items || []).map((kpi, i) => (
            <div key={i} className="glass-card rounded-2xl border border-white/5 p-4">
              <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-semibold text-white tabular-nums mt-1 leading-tight">{kpi.value}</p>
              {kpi.hint && <p className="text-[10px] text-muted-foreground mt-1">{kpi.hint}</p>}
            </div>
          ))}
        </div>
      );

    case 'chart':
      return (
        <div className="glass-card rounded-2xl border border-white/5 p-5">
          {block.title && <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-4">{block.title}</p>}
          <Grafico block={block} />
        </div>
      );

    case 'table':
      return (
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          {block.title && (
            <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02]">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{block.title}</p>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {(block.columns || []).map((c, i) => (
                    <th key={i} className="text-left px-5 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(block.rows || []).map((row, ri) => (
                  <tr key={ri}>
                    {(row || []).map((cell, ci) => (
                      <td key={ci} className={`px-5 py-2.5 tabular-nums ${ci === 0 ? 'text-white font-medium' : 'text-white/75'}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case 'divider':
      return <hr className="border-white/5" />;

    default:
      return null;
  }
}

export default function ReportBlocks({ blocks = [] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block, i) => <Bloco key={i} block={block} />)}
    </div>
  );
}
