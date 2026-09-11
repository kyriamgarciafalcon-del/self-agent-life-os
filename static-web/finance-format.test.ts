import { describe, expect, it } from 'vitest';
import { hideMoney } from '../app/components/finance/format';

describe('hideMoney', () => {
  it('keeps the formatted amount when not hidden', () => {
    expect(hideMoney('¥ 1,280.55', false)).toBe('¥ 1,280.55');
  });

  it('replaces digits and keeps currency marks when hidden', () => {
    expect(hideMoney('¥ 1,280.55', true)).toBe('¥ •,•••.••');
    expect(hideMoney('−$12.00', true)).toBe('−$••.••');
  });
});
