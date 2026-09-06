import { accountRole } from '../../product-logic';
import type { Account, Currency, InvestmentHolding } from './types';

export function money(value: number) {
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function currencyMark(currency: Currency | string) {
  return currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency === 'HKD' ? 'HK$' : currency === 'EUR' ? '€' : 'JP¥';
}

export function formatAssetAmount(currency: string, amount: number) {
  return `${amount < 0 ? '−' : ''}${currencyMark(currency)} ${money(Math.abs(amount))}`;
}

export function roleLabel(type: string) {
  const role = accountRole(type);
  if (role === 'receivable') return '债务 · 应收';
  if (role === 'payable' || role === 'liability') return '债务 · 应付';
  if (role === 'plan') return '计划扣款';
  return type;
}

export function canHoldMoney(account: Account | undefined) {
  return Boolean(account && accountRole(account.type) === 'asset' && !/物品资产|订阅账户/.test(account.type));
}

export function investmentValue(item: InvestmentHolding) {
  return item.quantity * item.currentPrice;
}

export function investmentProfit(item: InvestmentHolding) {
  return investmentValue(item) - item.quantity * item.averageCost;
}

export function holdingKindLabel(kind: InvestmentHolding['kind']) {
  return kind === 'fund' ? '基金 / ETF' : kind === 'stock' ? '股票' : kind === 'meme' ? 'Meme 币' : '虚拟货币';
}
