import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../app/', import.meta.url);
const page = readFileSync(new URL('page.tsx', root), 'utf8');

function source(rel: string) {
  const url = new URL(rel, root);
  expect(existsSync(url), rel).toBe(true);
  return readFileSync(url, 'utf8');
}

const ENGLISH_EYEBROWS = [
  'NET WORTH',
  'ACCOUNTS',
  'LEDGER',
  'DAILY SPEND',
  'EXCHANGE RATES',
  'MONTHLY BILLS',
  'INVESTMENTS',
  'HOLDINGS',
  'ACCOUNT LEDGER',
  'RETURN CURVE',
  'EDIT RECORD',
  'NEW RECORD',
  'NEW ACCOUNT',
  'EDIT ACCOUNT',
  'SETTLE ACCOUNT',
  'SETTLE REIMBURSEMENT',
  'NEW BILL',
  'EDIT BILL',
  'EXCHANGE RATE',
  'EDIT ASSET',
  'NEW ASSET',
];

describe('finance five-section extraction', () => {
  it('keeps page.tsx as a prop bus for FinancePage', () => {
    expect(page).toContain("from './components/finance/FinancePage'");
    expect(page).toContain('<FinancePage');
    expect(page).not.toContain('function FinancePanel');
    expect(page).not.toContain('function InvestmentList');
    expect(page).not.toContain('function HoldingDetail');
    expect(page).not.toContain('function TransactionList');
  });

  it('restyles five Chinese sections with grouped cards and no English eyebrows', () => {
    const finance = source('components/finance/FinancePage.tsx');
    expect(finance).toContain('export function FinancePage');
    expect(finance).toContain('sa-page');
    expect(finance).toContain('sa-group');
    expect(finance).toContain('sa-card');
    expect(finance).toContain('sa-row');
    expect(finance).toContain("aria-label=\"财务分类\"");
    expect(finance).toContain('总览');
    expect(finance).toContain('账户');
    expect(finance).toContain('投资');
    expect(finance).toContain('周期账单');
    expect(finance).toContain('流水');
    const tabOrder = finance.indexOf("'总览'");
    const accountsAt = finance.indexOf("'账户'");
    const investAt = finance.indexOf("'投资'");
    const billsAt = finance.indexOf("'周期账单'");
    const ledgerAt = finance.indexOf("'流水'");
    expect(tabOrder).toBeGreaterThan(0);
    expect(accountsAt).toBeGreaterThan(tabOrder);
    expect(investAt).toBeGreaterThan(accountsAt);
    expect(billsAt).toBeGreaterThan(investAt);
    expect(ledgerAt).toBeGreaterThan(billsAt);
    for (const eyebrow of ENGLISH_EYEBROWS) {
      expect(finance, eyebrow).not.toContain(eyebrow);
    }
    expect(finance).toContain('本月收入');
    expect(finance).toContain('本月支出');
    expect(finance).toContain('本月结余');
    expect(finance).toContain('净资产');
    expect(finance).toContain('添加第一个账户');
    expect(finance).toContain('编辑');
    expect(finance).toContain('查看账单');
    expect(finance).toContain('本月已确认');
    expect(finance).toContain('入账');
    expect(finance).toContain('删除');
    expect(finance).toContain('收回');
    expect(finance).toContain('还款');
    expect(finance).toContain('隐藏金额');
    expect(finance).toContain('显示金额');
    expect(finance).toContain('hideMoney');
  });

  it('keeps shipping ledger helpers and hides manual FX once network quotes exist', () => {
    const finance = source('components/finance/FinancePage.tsx');
    expect(finance).toContain('getMonthlyReport');
    expect(finance).toContain('getNetWorth');
    expect(finance).toContain('getConvertedNetWorth');
    expect(finance).toContain('transactionsInPeriod');
    expect(finance).toContain('investmentAccountSnapshot');
    expect(finance).toContain('normalizeAccountBalance');
    expect(finance).toContain('onRefreshQuotes');
    expect(finance).toContain('每日更新');
    expect(finance).toContain("source === 'daily'");
    expect(finance).not.toMatch(/filter\(\(item\) => item\.kind === 'expense'\)\.reduce/);
    expect(page).toContain('postFinanceTransaction');
    expect(page).toContain('removePostedTransaction');
    expect(page).toContain('planAccountSettlement');
    expect(page).toContain('buildReimbursementSettlement');
    expect(page).toContain('releaseRecurringConfirmation');
    expect(page).toContain('onSettleReimbursement');
    expect(page).toContain('onSettleAccount');
    expect(page).toContain('onRunRecurring');
    expect(page).toContain('onRefreshQuotes');
  });

  it('keeps account and ledger actions visible, 44px, mint, and gradient-free', () => {
    const finance = source('components/finance/FinancePage.tsx');
    const css = source('components/finance/finance.css');
    expect(finance).toContain('account-hero-ops');
    expect(finance).toContain('row-ops');
    expect(finance).not.toContain('account-edit-button');
    expect(css).toContain('#F2F2F7');
    expect(css).toContain('#2F6F57');
    expect(css).toContain('min-height:44px');
    expect(css).not.toContain('linear-gradient');
    expect(css).not.toContain('#007AFF');
    expect(css).toMatch(/overflow-x:\s*hidden/);
  });
});
