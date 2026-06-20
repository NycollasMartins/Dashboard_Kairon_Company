import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, RefreshCw, UserMinus, Heart, Repeat, Target, Coins, Timer,
} from 'lucide-react';
import { formatBRL } from '@/features/clientes/utils/contrato.format';
import {
  mrrMovementsYear, nrrGrrPeriodo, logoChurnMes, mrrChurnMes, ltvECarteira, cacPeriodo,
  MES_LABELS,
} from '@/features/financeiro/lib/financeiro.calc';
import { MiniKpi, Painel, fmtPct, fmtMult } from './financeUi';

export default function RecorrenciaSection({ contratos = [], clientes = [], custos = [], metrics = [], year }) {
  const now = new Date();
  const isCY = year === now.getFullYear();
  const mesFim = isCY ? now.getMonth() : 11;

  const calc = useMemo(() => {
    const movements = mrrMovementsYear(contratos, year, now);
    const ng = nrrGrrPeriodo(contratos, year, 0, mesFim, now);
    const churnMrr = mrrChurnMes(contratos, year, mesFim, now);
    const churnLogo = logoChurnMes(clientes, year, mesFim);
    const { ltvMedio, permanenciaMeses } = ltvECarteira(clientes, now);
    const cac = cacPeriodo({ custos, metrics, clientes, year, mesInicio: 0, mesFim, now });
    const chart = movements.map((mv, i) => ({
      mes: MES_LABELS[i],
      Novo: mv.novo,
      Expansão: mv.expansion,
      Contração: -mv.contraction,
      Churn: -mv.churned,
      net: mv.net,
    }));
    return { ng, churnMrr, churnLogo, ltvMedio, permanenciaMeses, cac, chart };
  }, [contratos, clientes, custos, metrics, year, mesFim, now]);

  const Tip = ({ active, payload, label }) => (active && payload?.length ? (
    <div className="glass-card border border-white/10 rounded-xl p-2.5 text-xs space-y-0.5">
      <p className="text-white font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>{p.name}: {formatBRL(Math.abs(p.value))}</p>
      ))}
    </div>
  ) : null);

  return (
    <div className="space-y-6">
      {/* KPIs de retenção */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniKpi icon={Repeat} label="NRR (retenção líquida)" value={fmtPct(calc.ng.nrr)} accent={calc.ng.nrr >= 100 ? 'emerald' : 'amber'} hint="Net Revenue Retention no ano: (base − churn − contração + expansão) ÷ base. >100% = carteira cresce sozinha." />
        <MiniKpi icon={Heart} label="GRR (retenção bruta)" value={fmtPct(calc.ng.grr)} accent="blue" hint="Gross Revenue Retention: (base − churn − contração) ÷ base. Teto 100%." />
        <MiniKpi icon={TrendingDown} label="MRR churn (mês)" value={fmtPct(calc.churnMrr.pct)} accent={calc.churnMrr.pct > 0 ? 'red' : 'emerald'} hint="MRR perdido (churn + contração) ÷ MRR do início do mês." />
        <MiniKpi icon={UserMinus} label="Logo churn (mês)" value={fmtPct(calc.churnLogo.pct)} accent={calc.churnLogo.pct > 0 ? 'red' : 'emerald'} hint="Clientes que saíram ÷ clientes ativos no início do mês." />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniKpi icon={Coins} label="LTV médio" value={formatBRL(calc.ltvMedio)} accent="purple" hint="Lifetime value médio por cliente (MRR × meses de contrato, ou total recebido se encerrado)." />
        <MiniKpi icon={Timer} label="Permanência média" value={`${calc.permanenciaMeses.toFixed(1).replace('.', ',')} m`} accent="blue" hint="Tempo médio de casa: churned usa churned_at − created_at; ativos usam hoje − created_at." />
        <MiniKpi icon={Target} label="CAC" value={formatBRL(calc.cac.cac)} accent="amber" hint="Custo de aquisição = (gasto em ads + custos de marketing) ÷ novos clientes no ano. Sem salário de closer (não cadastrado nos custos)." />
        <MiniKpi icon={RefreshCw} label="LTV : CAC" value={fmtMult(calc.cac.ltvCac)} accent={calc.cac.ltvCac >= 3 ? 'emerald' : 'amber'} hint={`Relação LTV/CAC. Saudável >= 3x. Payback do CAC: ~${calc.cac.paybackMeses.toFixed(1).replace('.', ',')} meses de MRR.`} />
      </div>

      {/* MRR movements empilhado */}
      <Painel title={`Movimentos de MRR · ${year}`}>
        <div className="p-5">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={calc.chart} stackOffset="sign" margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<Tip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
              <Bar dataKey="Novo" stackId="a" fill="#34d399" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Expansão" stackId="a" fill="#60a5fa" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Contração" stackId="a" fill="#fbbf24" radius={[0, 0, 2, 2]} />
              <Bar dataKey="Churn" stackId="a" fill="#EA3935" radius={[0, 0, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-muted-foreground mt-2">
            Acima de zero: ganho de MRR (novos + expansão). Abaixo: perda (contração + churn). A linha de cada mês é o MRR líquido movimentado.
          </p>
        </div>
      </Painel>
    </div>
  );
}
