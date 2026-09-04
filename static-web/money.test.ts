import { describe, expect, it } from 'vitest';
import { moneyAdd, moneyFromMajor, moneyToMajor, moneyZero } from '../app/money';
import { monthlyFinanceSummary } from '../app/finance-core';

describe('Money minor units', () => {
  it('adds 0.10 and 0.20 as 30 minor units without float residue', () => {
    const sum = moneyAdd(moneyFromMajor(0.1, 'CNY'), moneyFromMajor(0.2, 'CNY'));
    expect(sum).toEqual({ minor: '30', currency: 'CNY' });
    expect(moneyToMajor(sum)).toBe(0.3);
    expect(String(moneyToMajor(sum))).not.toContain('000000');
  });

  it('keeps JPY as whole minor units', () => {
    expect(moneyFromMajor(128, 'JPY')).toEqual({ minor: '128', currency: 'JPY' });
    expect(moneyToMajor(moneyFromMajor(128, 'JPY'))).toBe(128);
  });

  it('refuses mixed-currency addition', () => {
    expect(() => moneyAdd(moneyFromMajor(1, 'CNY'), moneyFromMajor(1, 'USD'))).toThrow(/currency/);
  });

  it('monthly report accumulates through Money minors', () => {
    const report = monthlyFinanceSummary([
      { kind: 'expense', currency: 'CNY', amount: 0.1 },
      { kind: 'expense', currency: 'CNY', amount: 0.2 },
    ], 'CNY');
    expect(report.expense).toBe(0.3);
    expect(String(report.expense)).not.toContain('000000');
  });

  it('starts at zero minors', () => {
    expect(moneyZero('CNY')).toEqual({ minor: '0', currency: 'CNY' });
  });
});
