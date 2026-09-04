import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('health dashboard UI contract', () => {
  it('uses a sports-health layout with separate import actions and no fake score hero', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    const panelStart = page.indexOf('function HealthPanel');
    const panelEnd = page.indexOf('function parseTravelText');
    const healthPanel = page.slice(panelStart, panelEnd);

    expect(healthPanel).toContain('今日状态');
    expect(healthPanel).toContain('7 日趋势');
    expect(healthPanel).toContain('Health Connect');
    expect(healthPanel).toContain('Gadgetbridge');
    expect(healthPanel).toContain('导入排障');
    expect(healthPanel).toContain('onImportHealthConnect');
    expect(healthPanel).toContain('onImportGadgetbridge');
    expect(healthPanel).not.toContain('<span>本机健康记录</span>');
    expect(healthPanel).not.toMatch(/records\.length \|\| '—'/);
    expect(healthPanel).not.toMatch(/onClick=\{onImport\}>同步</);
    expect(page).toContain('native?.importHealthConnect');
    expect(page).toContain('native.importHealthConnect()');
  });
});
