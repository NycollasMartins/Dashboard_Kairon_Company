import { describe, it, expect } from 'vitest';
import { cortarMesesFuturos, tcvDoMes } from '@/features/financeiro/lib/financeiro.calc';

describe('cortarMesesFuturos (ITEM 3)', () => {
  const serie = Array.from({ length: 12 }, (_, i) => i + 1); // [1..12]

  it('no ano corrente, zera os meses futuros (índices > mês atual)', () => {
    const now = new Date(2026, 5, 15); // junho (índice 5)
    const r = cortarMesesFuturos(serie, 2026, now);
    expect(r.slice(0, 6)).toEqual([1, 2, 3, 4, 5, 6]); // jan..jun mantidos
    expect(r.slice(6)).toEqual([0, 0, 0, 0, 0, 0]); // jul..dez zerados
  });

  it('em ano fechado (passado), retorna a série cheia', () => {
    const now = new Date(2026, 5, 15);
    expect(cortarMesesFuturos(serie, 2025, now)).toEqual(serie);
  });

  it('receita e custo ficam consistentes (mesmo nº de meses contados)', () => {
    const now = new Date(2026, 2, 10); // março (índice 2)
    const receita = cortarMesesFuturos([10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10], 2026, now);
    const custoRecorrente = cortarMesesFuturos(new Array(12).fill(5), 2026, now);
    // Ambos cortados em março: 3 meses (jan, fev, mar).
    expect(receita.reduce((a, b) => a + b, 0)).toBe(30);
    expect(custoRecorrente.reduce((a, b) => a + b, 0)).toBe(15);
  });
});

describe('tcvDoMes — só TCV ativo conta', () => {
  const clientes = [{
    status: 'ativo',
    contratos: [
      { tipo: 'TCV', status: 'ativo', valor: 5000, data_inicio: '2026-06-10' },
      { tipo: 'TCV', status: 'cancelado', valor: 9000, data_inicio: '2026-06-12' },
    ],
  }];

  it('soma TCV ativo do mês e ignora o cancelado', () => {
    expect(tcvDoMes(clientes, 2026, 5)).toBe(5000); // junho = índice 5
  });

  it('ignora cliente em churn', () => {
    const churn = [{ ...clientes[0], status: 'churn' }];
    expect(tcvDoMes(churn, 2026, 5)).toBe(0);
  });
});
