import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inboxAccountsForCurrency } from '../app/product-logic';

describe('inbox finance editor', () => {
  it('only offers accounts matching the selected currency', () => {
    const accounts = [
      { id: 'cny', currency: 'CNY' },
      { id: 'usd', currency: 'USD' },
      { id: 'eur', currency: 'EUR' },
    ];
    expect(inboxAccountsForCurrency(accounts, 'USD').map((item) => item.id)).toEqual(['usd']);
    expect(inboxAccountsForCurrency(accounts, 'usd').map((item) => item.id)).toEqual(['usd']);
    expect(inboxAccountsForCurrency(accounts, '').map((item) => item.id)).toEqual(['cny', 'usd', 'eur']);
  });

  it('ships a real currency selector and notification card hierarchy', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
    expect(page).toContain('aria-label="币种"');
    expect(page).not.toContain('<label>币种<input');
    expect(page).toContain('inbox-card-amount');
    expect(page).toContain('inbox-card-source');
    expect(css).toContain('.inbox-card-amount');
    expect(css).toContain('.inbox-card-source');
  });
});
