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
    const records = readFileSync(new URL('../app/components/daily/RecordsPage.tsx', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
    expect(records).toContain('aria-label="币种"');
    expect(records).not.toContain('<label>币种<input');
    expect(records).toContain('inbox-card-amount');
    expect(records).toContain('inbox-card-source');
    expect(css).toContain('.inbox-card-amount');
    expect(css).toContain('.inbox-card-source');
  });

  it('lets voice and OCR fill the capture box without creating a second inbox item', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    const start = page.indexOf('function onCaptureText');
    const chunk = page.slice(start, start + 1800);
    expect(chunk).toContain('setCaptureText');
    expect(chunk).not.toContain('withInboxEvent');
  });
});
