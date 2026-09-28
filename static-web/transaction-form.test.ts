import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { previewPostedImpact, transactionFormPhases } from '../app/finance-core';

describe('quick transaction form', () => {
  it('keeps ordinary expenses on one screen with occurrence date and impact preview', () => {
    expect(transactionFormPhases('expense')).toEqual([[
      'kind', 'amount', 'accountId', 'merchant', 'category', 'currency', 'occurredAt', 'reimbursable', 'preview',
    ]]);
    expect(transactionFormPhases('expense', { reimbursable: true })[0]).toContain('reimburseAccountId');
    expect(transactionFormPhases('income')[0]).toEqual(['kind', 'amount']);
    expect(transactionFormPhases('transfer', { sameCurrency: false })[1]).toContain('rate');
  });

  it('explains cash and receivable impact before posting', () => {
    expect(previewPostedImpact({ kind: 'expense', amount: 36, accountName: '微信' })).toContain('微信');
    expect(previewPostedImpact({ kind: 'expense', amount: 36, accountName: '微信', reimbursable: true })).toContain('待收回');
    expect(previewPostedImpact({ kind: 'transfer', amount: 100, accountName: '微信', targetName: '银行卡' })).toContain('不计入本月');
  });

  it('walks the shipped composer through phases before posting', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain('transactionFormPhases');
    expect(page).toContain('previewPostedImpact');
    expect(page).toContain('下一步');
  });
});
