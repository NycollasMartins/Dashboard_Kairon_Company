import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Scale, PieChart, LineChart as LineIcon } from 'lucide-react';
import { formatBRL } from '@/features/clientes/utils/contrato.format';
import {
  drePeriodo, projecaoMrr, breakEvenMensal, mixCarteira,
} from '@/features/financeiro/lib/financeiro.calc';
import { MiniKpi, Painel, fmtPct } from './financeUi';

const CAT_LABELS = {
  salarios: 'Salários', ferramentas: 'Ferramentas / SaaS', infraestrutura: 'Infraestrutura',
  impostos: 'Impostos', marketing: 'Marketing', outros: 'Outros',
};

export default function DreProjecaoSection({ contratos = [], custos = [], metrics = [], year, modoTcv = 'caixa' }) {
  const now = new Date();
  const isCY = year === now.getFullYear();
  const mesFim = isCY ? now.getMonth() : 11;

  const calc = useMemo(() => {
    const dre = drePeriodo({ contratos, custos, metrics, year, mesInicio: 0, mesFim, modoTcv, now });
    const mix = mixCarteira(contratos, year, now, modoTcv);
    const proj = projecaoMrr(contratos, 6, now);
    const breakEven = breakEvenMensal(custos, metrics, year, mesFim);
    return { dre, mix, proj, breakEven };
  }, [contratos, custos, metrics, year, mesFim, modoTcv, now]);

  const catRows = Object.entries(calc.dre.custosPorCategoria).sort((a, b) => b[1] - a[1]);
  const projData = calc.proj.map((p) => ({ mes: p.label, MRR: p.mrr }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniKpi icon={Scale} label={`Lucro ${isCY ? 'no ano' : year} (${modoTcv === 'caixa' ? 'caixa' : 'competência'})`} value={formatBRL(calc.dre.lucro)} accent={calc.dre.lucro >= 0 ? 'emerald' : 'red'} hint="Receita reconhecida − custos operacionais − ads no período." />
        <MiniKpi icon={PieChart} label="Margem líquida" value={fmtPct(calc.dre.margemPct)} accent={calc.dre.margemPct >= 0 ? 'emerald' : 'red'} />
        <MiniKpi icon={LineIcon} label="% recorrente (previsibilidade)" value={fmtPct(calc.mix.pctRecorrente)} accent="purple" hint="Quanto do faturamento é MRR. Quanto maior, mais previsível a agência." />
        <MiniKpi icon={Scale} label="Break-even mensal" value={formatBRL(calc.breakEven)} accent="amber" hint="Receita mínima do mês para lucro zero = custos operacionais + ads do mês." />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* DRE simplificado */}
        <Painel title={`DRE simplificado · ${year} (${modoTcv === 'caixa' ? 'regime caixa' : 'competência'})`}>
          <div className="p-5 space-y-2 text-sm">
            <Row label="Receita reconhecida" value={formatBRL(calc.dre.receita)} bold accent="emerald" />
            <div className="h-px bg-white/5 my-1" />
            {catRows.map(([cat, val]) => (
              <Row key={cat} label={`(−) ${CAT_LABELS[cat] || cat}`} value={formatBRL(val)} muted />
            ))}
            <Row label="(−) Gasto em ads" value={formatBRL(calc.dre.ads)} muted />
            <div className="h-px bg-white/5 my-1" />
            <Row label="(=) Custo total" value={formatBRL(calc.dre.custoTotal)} />
            <div className="h-px bg-white/10 my-1" />
            <Row label="(=) Lucro líquido" value={formatBRL(calc.dre.lucro)} bold accent={calc.dre.lucro >= 0 ? 'emerald' : 'red'} />
            <Row label="Margem" value={fmtPct(calc.dre.margemPct)} muted />
          </div>
        </Painel>

        {/* Mix da carteira + projeção */}
        <div className="space-y-4">
          <Painel title="Mix da carteira · ano">
            <div className="p-5 space-y-3">
              <Barra label="Recorrente (MRR)" value={calc.mix.mrr} total={calc.mix.total} color="#34d399" textCls="text-emerald-300" />
              <Barra label="Pontual (TCV)" value={calc.mix.tcv} total={calc.mix.total} color="#60a5fa" textCls="text-blue-300" />
            </div>
          </Painel>
          <Painel title="Projeção de MRR contratado · próximos 6 meses">
            <div className="p-4">
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={projData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={({ active, payload, label }) => (active && payload?.length ? (
                    <div className="glass-card border border-white/10 rounded-xl p-2 text-xs"><p className="text-white">{label}</p><p className="text-purple-300">{formatBRL(payload[0].value)}</p></div>
                  ) : null)} />
                  <Bar dataKey="MRR" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-muted-foreground mt-1">Base previsível: MRR já contratado que segue vigente em cada mês futuro.</p>
            </div>
          </Painel>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, muted, accent }) {
  const color = accent === 'emerald' ? 'text-emerald-300' : accent === 'red' ? 'text-[#EA3935]' : 'text-white';
  return (
    <div className="flex items-center justify-between">
      <span className={`${muted ? 'text-muted-foreground' : 'text-white'} ${bold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`tabular-nums ${bold ? 'font-semibold' : ''} ${muted ? 'text-muted-foreground' : color}`}>{value}</span>
    </div>
  );
}

function Barra({ label, value, total, color, textCls }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className={textCls}>{label}</span>
        <span className="text-white tabular-nums">{formatBRL(value)} · {pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
