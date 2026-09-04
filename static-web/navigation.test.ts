import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('primary navigation', () => {
  it('uses today inbox finance life and profile as the five root tabs', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain("label: '今天'");
    expect(page).toContain("label: '收件箱'");
    expect(page).toContain("label: '财务'");
    expect(page).toContain("label: '生活'");
    expect(page).toContain("label: '我的'");
    expect(page).not.toContain("label: '首页'");
    expect(page).toContain("id: 'life'");
  });
});
