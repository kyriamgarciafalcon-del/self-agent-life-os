import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../app/', import.meta.url);
const page = readFileSync(new URL('page.tsx', root), 'utf8');
const cssFiles = [
  readFileSync(new URL('globals.css', root), 'utf8'),
  readFileSync(new URL('components/ui/shell.css', root), 'utf8'),
  existsSync(new URL('components/mine/mine.css', root))
    ? readFileSync(new URL('components/mine/mine.css', root), 'utf8')
    : '',
].join('\n');

function source(rel: string) {
  const url = new URL(rel, root);
  expect(existsSync(url), rel).toBe(true);
  return readFileSync(url, 'utf8');
}

describe('profile experience extraction', () => {
  it('keeps page.tsx as a prop bus for ProfilePage and LifePage', () => {
    expect(page).toContain("from './components/mine/ProfilePage'");
    expect(page).toContain("from './components/mine/LifePage'");
    expect(page).toContain('<ProfilePage');
    expect(page).toContain('<LifePage');
    expect(page).not.toContain('className="page profile-page"');
    expect(page).not.toMatch(/\{tab === 'life' && <div className="page feature-page">/);
  });

  it('builds Apple-style grouped settings rows with mint, not iOS blue', () => {
    const primitives = source('components/mine/primitives.tsx');
    const profile = source('components/mine/ProfilePage.tsx');
    const css = source('components/mine/mine.css') + cssFiles;

    expect(primitives).toContain('export function SettingsGroup');
    expect(primitives).toContain('export function SettingsRow');
    expect(primitives).toContain('sa-group');
    expect(primitives).toContain('sa-row');
    expect(profile).toContain('<SettingsGroup');
    expect(profile).toContain('<SettingsRow');
    expect(profile).toContain('设置与扩展');
    expect(css).toContain('#F2F2F7');
    expect(css).toMatch(/--accent:\s*#2F6F57/i);
    expect(css).not.toContain('#007AFF');
    expect(css).toMatch(/\.sa-row\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.profile-page\{[^}]*overflow-x:\s*hidden/);
  });

  it('keeps shipping profile capabilities and rejects Apple fake reset/water/passwords', () => {
    const profile = source('components/mine/ProfilePage.tsx');
    const life = source('components/mine/LifePage.tsx');

    for (const label of ['生活', '系统权限引导', '操作历史', '选择 ZIP 所在文件夹', 'AI 记忆管理', '隐私与权限', '密码库', '数据中心']) {
      expect(profile).toContain(label);
    }
    expect(profile).toContain('保存接口');
    expect(profile).toContain('测试连接');
    expect(profile).toContain('第1步：打开无障碍（自动记账）');
    expect(profile).toContain('第2步：打开通知使用权');
    expect(profile).toContain('第3步：设为自动填充服务');
    expect(profile).toContain('切换');
    expect(profile).toContain('导出全部数据');
    expect(profile).toContain('从备份恢复');
    expect(profile).toContain('加载演示数据');
    expect(profile).toContain('清空本机数据');

    expect(life).toContain('健康');
    expect(life).toContain('出行');
    expect(life).toContain('记忆');
    expect(life).toContain('管家');

    expect(profile).not.toContain('重置演示数据');
    expect(profile).not.toContain('+200ml');
    expect(profile).not.toContain('+1000 步');
    expect(profile).not.toContain('模拟解锁');
    expect(profile).not.toContain('••••••••');
  });
});
