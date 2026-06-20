import { describe, it, expect } from 'vitest';
import {
  receitaDoMes, vendasAvulsasDoMes, recebiveis, cronogramaReceber,
  mrrMovementsAtMonth, receitaSeriesYear, caixaRecebidoSeriesYear, mixCarteira,
} from '@/features/financeiro/lib/financeiro.calc';

const cli = (over = {}) => ({ id: over.id || 'c1', status: 'ativo', contratos: [], ...over });
const ct = (over = {}) => ({ tipo: 'MRR', status: 'ativo', valor: 1000, duracao_meses: 12, data_inicio: '2026-01-15', ...over });

describe('receitaDoMes (Financeiro == Metas, com avulsas)', () => {
  it('soma MRR ativo + TCV do mês + vendas avulsas do mês', () => {
    const clientes = [
      cli({ id: 'a', contratos: [ct({ tipo: 'MRR', valor: 2000 })] }),
      cli({ id: 'b', contratos: [ct({ tipo: 'TCV', valor: 5000, data_inicio: '2026-03-10' })] }),
    ];
    const vendas = [
      { valor: 700, contrato_id: null, data_venda: '2026-03-20' }, // avulsa de março
      { valor: 999, contrato_id: 'x', data_venda: '2026-03-21' },  // de contrato: NÃO conta de novo
      { valor: 500, contrato_id: null, data_venda: '2026-02-01' }, // outro mês
    ];
    // março (mês 2): MRR 2000 + TCV 5000 + avulsa 700 = 7700
    expect(receitaDoMes(clientes, vendas, 2026, 2)).toBe(7700);
    expect(vendasAvulsasDoMes(vendas, 2026, 2)).toBe(700);
  });
});

describe('recebiveis / inadimplência', () => {
  it('separa pago, vencido em aberto e a vencer', () => {
    const hoje = new Date('2026-06-20');
    const parcelas = [
      { valor: 1000, vencimento: '2026-05-01', pago_em: '2026-05-01', status: 'pago' },   // pago vencido
      { valor: 1000, vencimento: '2026-05-10', pago_em: null, status: 'em_aberto' },        // vencido em aberto (inadimplência)
      { valor: 1000, vencimento: '2026-07-01', pago_em: null, status: 'em_aberto' },        // a vencer
      { valor: 1000, vencimento: '2026-04-01', pago_em: null, status: 'estornado' },        // ignorado
    ];
    const r = recebiveis(parcelas, hoje);
    expect(r.emAberto).toBe(2000);
    expect(r.inadimplencia).toBe(1000);
    expect(r.aVencer).toBe(1000);
    // inadimplência% = vencido aberto / (vencido aberto + pago vencido) = 1000/2000 = 50%
    expect(r.inadimplenciaPct).toBeCloseTo(50);
  });

  it('cronograma agrupa em aberto por competência', () => {
    const parcelas = [
      { valor: 100, competencia: '2026-07-01', pago_em: null, status: 'em_aberto' },
      { valor: 200, competencia: '2026-07-01', pago_em: null, status: 'em_aberto' },
      { valor: 300, competencia: '2026-08-01', pago_em: null, status: 'em_aberto' },
    ];
    const cron = cronogramaReceber(parcelas, new Date('2026-06-20'));
    expect(cron[0]).toEqual({ competencia: '2026-07', valor: 300, qtd: 2 });
    expect(cron[1]).toEqual({ competencia: '2026-08', valor: 300, qtd: 1 });
  });
});

describe('MRR movements', () => {
  it('detecta new e churn entre meses', () => {
    const now = new Date('2026-12-31');
    // cliente A: MRR ativo jan-dez; cliente B: MRR que cancela em fevereiro
    const contratos = [
      { tipo: 'MRR', valor: 1000, status: 'ativo', data_inicio: '2026-01-01', data_fim: '2026-12-31', cliente_id: 'A' },
      { tipo: 'MRR', valor: 500, status: 'cancelado', data_inicio: '2026-01-01', data_fim: '2026-12-31', data_cancelamento: '2026-02-10', cliente_id: 'B' },
    ];
    // janeiro (m=0): ambos entram -> new = 1500
    const jan = mrrMovementsAtMonth(contratos, 2026, 0, now);
    expect(jan.novo).toBe(1500);
    // março (m=2): B já saiu em fev -> churned 500 aparece na transição fev->mar? B vigente até 10/02,
    // então em fevereiro ainda conta; em março não. churn em março = 500.
    const mar = mrrMovementsAtMonth(contratos, 2026, 2, now);
    expect(mar.churned).toBe(500);
  });
});

describe('reconhecimento TCV: caixa vs linear', () => {
  it('caixa joga tudo no mês de início; linear dilui pela duração', () => {
    const contratos = [{ tipo: 'TCV', status: 'ativo', valor: 1200, duracao_meses: 12, data_inicio: '2026-01-15', data_fim: '2026-12-31' }];
    const caixa = receitaSeriesYear(contratos, 2026, new Date('2026-12-31'), 'caixa');
    expect(caixa[0]).toBe(1200); // tudo em janeiro
    expect(caixa[6]).toBe(0);
    const linear = receitaSeriesYear(contratos, 2026, new Date('2026-12-31'), 'linear');
    expect(linear[0]).toBeCloseTo(100); // 1200/12
    expect(linear[6]).toBeCloseTo(100);
  });
});

describe('caixa recebido por mês (parcelas pagas)', () => {
  it('soma só parcelas pagas, pelo mês do pago_em', () => {
    const parcelas = [
      { valor: 1000, pago_em: '2026-03-05', status: 'pago' },
      { valor: 2000, pago_em: null, status: 'em_aberto' },
      { valor: 500, pago_em: '2026-03-20', status: 'pago' },
    ];
    const s = caixaRecebidoSeriesYear(parcelas, 2026);
    expect(s[2]).toBe(1500); // março
  });
});

describe('mix da carteira', () => {
  it('calcula % recorrente vs pontual', () => {
    const contratos = [
      { tipo: 'MRR', status: 'ativo', valor: 1000, data_inicio: '2026-01-01', data_fim: '2026-12-31' },
      { tipo: 'TCV', status: 'ativo', valor: 6000, duracao_meses: 6, data_inicio: '2026-01-10', data_fim: '2026-07-09' },
    ];
    const mix = mixCarteira(contratos, 2026, new Date('2026-12-31'), 'caixa');
    // MRR ano = 12*1000 = 12000; TCV caixa = 6000; total 18000
    expect(mix.mrr).toBe(12000);
    expect(mix.tcv).toBe(6000);
    expect(mix.pctRecorrente).toBeCloseTo(66.67, 1);
  });
});
