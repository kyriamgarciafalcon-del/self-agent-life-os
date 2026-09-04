import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('core UI components', () => {
  it('uses LargeTitle and GroupedList on life and profile', () => {
    const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
    expect(page).toContain('from \'./ui\'');
    expect(page).toContain('<LargeTitle');
    expect(page).toContain('<GroupedList');
  });
});
