import { describe, expect, it } from 'vitest';
import { PRIMARY_NAV } from '../app/components/ui/nav';

describe('primary navigation', () => {
  it('uses home schedule capture finance and profile as the five root tabs', () => {
    expect(PRIMARY_NAV.map((item) => item.id)).toEqual(['home', 'schedule', 'capture', 'finance', 'profile']);
    expect(PRIMARY_NAV.map((item) => item.label)).toEqual(['首页', '日程', '记录', '财务', '我的']);
  });
});
