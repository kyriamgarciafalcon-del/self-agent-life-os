import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('apple-style design tokens', () => {
  it('sets grouped light surfaces, 14px body, 44px nav hits, and mint accent', () => {
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
    expect(css).toContain('--page-bg:#F2F2F7');
    expect(css).toContain('--surface:#FFFFFF');
    expect(css).toContain('--accent:#2F6F57');
    expect(css).toContain('body{font-size:14px');
    expect(css).toMatch(/\.bottom-nav button\{[^}]*min-height:44px/);
    expect(css).toMatch(/\.app-header h1\{[^}]*font-size:22px/);
  });
});
