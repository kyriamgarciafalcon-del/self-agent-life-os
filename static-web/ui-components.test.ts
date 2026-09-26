import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('core UI components', () => {
  it('uses LargeTitle and GroupedList on the life and profile pages', () => {
    const life = readFileSync(new URL('../app/components/mine/LifePage.tsx', import.meta.url), 'utf8');
    const profile = readFileSync(new URL('../app/components/mine/ProfilePage.tsx', import.meta.url), 'utf8');
    for (const page of [life, profile]) {
      expect(page).toContain("from '../../ui'");
      expect(page).toContain('<LargeTitle');
      expect(page).toContain('<GroupedList>');
    }
  });

  it('keeps the large home title and grouped profile settings after extraction', () => {
    const home = readFileSync(new URL('../app/components/daily/HomePage.tsx', import.meta.url), 'utf8');
    const profile = readFileSync(new URL('../app/components/mine/ProfilePage.tsx', import.meta.url), 'utf8');
    expect(home).toContain("from '../../ui'");
    expect(home).toContain('<LargeTitle');
    expect(profile).toContain('<SettingsGroup');
    expect(profile).toContain('<SettingsRow');
  });
});
