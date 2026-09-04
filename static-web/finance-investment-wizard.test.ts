import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  confirmInvestmentMigration,
  migrateInvestmentCash,
  planInvestmentMigrations,
  investmentAccountSnapshot,
} from '../app/finance-core';

describe('investment migration wizard', () => {
  const account = { id: 'inv', type: '理财账户', currency: 'CNY', balance: 40 };
  const holdings = [{ id: 'h1', accountId: 'inv', quantity: 10, currentPrice: 4 }];

  it('does not silently rewrite a legacy 理财账户 whose stored balance equals market value', () => {
    const migrated = migrateInvestmentCash([account], holdings);
    expect(migrated[0]?.openingBalance).toBeUndefined();
    expect(migrated[0]?.balance).toBe(40);
    expect(planInvestmentMigrations([account], holdings)).toEqual([{
      accountId: 'inv',
      currency: 'CNY',
      oldBalance: 40,
      marketValue: 40,
      inferredDelta: 0,
      choices: ['cash', 'market', 'total'],
    }]);
  });

  it('applies the user choice of market vs cash vs total without guessing', () => {
    expect(confirmInvestmentMigration([account], holdings, 'inv', 'market')[0]).toMatchObject({ openingBalance: 0, balance: 0 });
    expect(confirmInvestmentMigration([account], holdings, 'inv', 'cash')[0]).toMatchObject({ openingBalance: 40, balance: 40 });
    expect(confirmInvestmentMigration([{ ...account, balance: 90 }], holdings, 'inv', 'total')[0]).toMatchObject({ openingBalance: 50, balance: 50 });
    expect(investmentAccountSnapshot(
      confirmInvestmentMigration([account], holdings, 'inv', 'market')[0],
      holdings,
    )).toEqual({ cash: 0, marketValue: 40, total: 40 });
  });

  it('asks in the shipped finance page instead of guessing', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain('planInvestmentMigrations');
    expect(page).toContain('confirmInvestmentMigration');
    expect(page).toContain('旧余额代表');
  });
});
