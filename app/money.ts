export type Money = {
  minor: string;
  currency: string;
};

const ZERO_SCALE_CURRENCIES = new Set(['JPY']);

export function moneyScale(currency: string): number {
  return ZERO_SCALE_CURRENCIES.has(currency) ? 0 : 2;
}

export function moneyZero(currency: string): Money {
  return { minor: '0', currency };
}

export function moneyFromMajor(amount: number, currency: string): Money {
  const scale = moneyScale(currency);
  const factor = 10 ** scale;
  const minor = Number.isFinite(amount) ? Math.round(Math.abs(amount) * factor) : 0;
  return { minor: String(minor), currency };
}

export function moneyToMajor(money: Money): number {
  const scale = moneyScale(money.currency);
  const minor = BigInt(money.minor || '0');
  if (scale === 0) return Number(minor);
  return Number(minor) / (10 ** scale);
}

export function moneyAdd(left: Money, right: Money): Money {
  if (left.currency !== right.currency) {
    throw new Error(`currency mismatch: ${left.currency} vs ${right.currency}`);
  }
  return { minor: String(BigInt(left.minor || '0') + BigInt(right.minor || '0')), currency: left.currency };
}

export function moneySum(currency: string, amounts: number[]): Money {
  return amounts.reduce((sum, amount) => moneyAdd(sum, moneyFromMajor(amount, currency)), moneyZero(currency));
}
