import { describe, it, expect } from 'vitest';
import { mrrDoCliente, getContratoAtivo } from '@/features/clientes/api/contratos.api';

describe('mrrDoCliente', () => {
  it('soma o MRR ativo mesmo quando há um TCV ativo mais recente na lista (ITEM 6)', () => {
    // Lista ordenada por data desc: o TCV (mais recente) vem primeiro.
    const contratos = [
      { tipo: 'TCV', status: 'ativo', valor: 9000, data_inicio: '2026-06-01' },
      { tipo: 'MRR', status: 'ativo', valor: 2500, data_inicio: '2026-01-01' },
    ];
    expect(mrrDoCliente(contratos)).toBe(2500);
  });

  it('soma múltiplos contratos MRR ativos', () => {
    const contratos = [
      { tipo: 'MRR', status: 'ativo', valor: 2500 },
      { tipo: 'MRR', status: 'ativo', valor: 1500 },
      { tipo: 'MRR', status: 'cancelado', valor: 9999 },
    ];
    expect(mrrDoCliente(contratos)).toBe(4000);
  });

  it('ignora MRR não-ativo e retorna 0 sem MRR ativo', () => {
    expect(mrrDoCliente([{ tipo: 'MRR', status: 'cancelado', valor: 2500 }])).toBe(0);
    expect(mrrDoCliente([{ tipo: 'TCV', status: 'ativo', valor: 9000 }])).toBe(0);
    expect(mrrDoCliente([])).toBe(0);
    expect(mrrDoCliente(null)).toBe(0);
  });

  it('getContratoAtivo continua retornando o primeiro contrato ativo (inalterado)', () => {
    const contratos = [
      { tipo: 'TCV', status: 'ativo', valor: 9000 },
      { tipo: 'MRR', status: 'ativo', valor: 2500 },
    ];
    expect(getContratoAtivo(contratos).tipo).toBe('TCV');
  });
});
