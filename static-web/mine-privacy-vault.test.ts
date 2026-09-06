import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../app/', import.meta.url);
const page = readFileSync(new URL('page.tsx', root), 'utf8');

function source(rel: string) {
  const url = new URL(rel, root);
  expect(existsSync(url), rel).toBe(true);
  return readFileSync(url, 'utf8');
}

describe('privacy memory and vault surface extraction', () => {
  it('keeps page.tsx as a prop bus for PrivacyPage, MemoryPage and VaultPage', () => {
    expect(page).toContain("from './components/mine/surfaces/PrivacyPage'");
    expect(page).toContain("from './components/mine/surfaces/MemoryPage'");
    expect(page).toContain("from './components/mine/surfaces/VaultPage'");
    expect(page).toContain('<PrivacyPage');
    expect(page).toContain('<MemoryPage');
    expect(page).toContain('<VaultPage');
    expect(page).not.toContain('function PrivacyPanel');
    expect(page).not.toContain('function MemoryPanel');
    expect(page).not.toContain('function VaultPanel');
    expect(page).not.toContain('function HowToNative');
  });

  it('restyles privacy with four real switches and a permanently closed password row', () => {
    const privacy = source('components/mine/surfaces/PrivacyPage.tsx');
    expect(privacy).toContain('mine-surface');
    expect(privacy).toContain('sa-page-header');
    expect(privacy).toContain('sa-group');
    expect(privacy).toContain('sa-row');
    expect(privacy).toContain('健康摘要');
    expect(privacy).toContain('财务摘要');
    expect(privacy).toContain('日程与行动');
    expect(privacy).toContain('记忆摘要');
    expect(privacy).toContain('密码与恢复码');
    expect(privacy).toContain('密码权限永久关闭');
    expect(privacy).toContain('disabled');
    expect(privacy).toContain('onToggle');
    expect(privacy).not.toContain('重置演示数据');
  });

  it('restyles memory with pause, send and delete controls', () => {
    const memory = source('components/mine/surfaces/MemoryPage.tsx');
    expect(memory).toContain('mine-surface');
    expect(memory).toContain('sa-card');
    expect(memory).toContain('暂停使用');
    expect(memory).toContain('重新启用');
    expect(memory).toContain('允许发送给 AI');
    expect(memory).toContain('禁止发送给 AI');
    expect(memory).toContain('删除');
    expect(memory).toContain('onToggleSend');
    expect(memory).toContain('normalizeMemory');
  });

  it('restyles vault as metadata-only with native revealPassword and no simulated secrets', () => {
    const vault = source('components/mine/surfaces/VaultPage.tsx');
    expect(vault).toContain('mine-surface');
    expect(vault).toContain('sa-group');
    expect(vault).toContain('sa-card');
    expect(vault).toContain('revealPassword');
    expect(vault).toContain('查看');
    expect(vault).toContain('HowToNative');
    expect(vault).toContain('账号目录');
    expect(vault).toContain('指纹或锁屏');
    expect(vault).not.toContain('模拟解锁');
    expect(vault).not.toContain('••••••••');
    expect(vault).not.toContain('银行 App');
  });
});
