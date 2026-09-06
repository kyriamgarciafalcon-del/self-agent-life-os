import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../app/', import.meta.url);
const page = readFileSync(new URL('page.tsx', root), 'utf8');
const cssFiles = [
  readFileSync(new URL('globals.css', root), 'utf8'),
  readFileSync(new URL('components/mine/mine.css', root), 'utf8'),
].join('\n');

function source(rel: string) {
  const url = new URL(rel, root);
  expect(existsSync(url), rel).toBe(true);
  return readFileSync(url, 'utf8');
}

describe('health and travel surface extraction', () => {
  it('keeps page.tsx as a prop bus for HealthPage and TravelPage', () => {
    expect(page).toContain("from './components/mine/surfaces/HealthPage'");
    expect(page).toContain("from './components/mine/surfaces/TravelPage'");
    expect(page).toContain('<HealthPage');
    expect(page).toContain('<TravelPage');
    expect(page).not.toContain('function HealthPanel');
    expect(page).not.toContain('function TravelPanel');
    expect(page).not.toContain('function HealthTrendBars');
    expect(page).not.toContain('function parseTravelText');
  });

  it('restyles health with Apple grouped surfaces and shipping health actions', () => {
    const health = source('components/mine/surfaces/HealthPage.tsx');
    const css = cssFiles;

    expect(health).toContain('mine-surface');
    expect(health).toContain('sa-page-header');
    expect(health).toContain('sa-group');
    expect(health).toContain('sa-card');
    expect(health).toContain('sa-row');
    expect(health).toContain('今日状态');
    expect(health).toContain('7 日趋势');
    expect(health).toContain('Health Connect');
    expect(health).toContain('Gadgetbridge');
    expect(health).toContain('选择 ZIP');
    expect(health).toContain('导入排障');
    expect(health).toContain('手动添加健康记录');
    expect(health).toContain('身体资料');
    expect(health).toContain('onImportHealthConnect');
    expect(health).toContain('onImportGadgetbridge');
    expect(health).toContain('onSelectExport');
    expect(health).toContain('onExportDiagnostics');
    expect(health).toContain('onSaveBody');
    expect(health).toContain('小时');
    expect(health).toContain('分钟');
    expect(health).toContain('不是诊断');
    expect(health).not.toContain('+200ml');
    expect(health).not.toContain('+1000 步');
    expect(health).not.toContain('+200ml 水');
    expect(css).toContain('#F2F2F7');
    expect(css).toMatch(/--accent:\s*#2F6F57/i);
    expect(css).not.toContain('#007AFF');
  });

  it('restyles travel with Apple surfaces and keeps notify/paste/manual/delete', () => {
    const travel = source('components/mine/surfaces/TravelPage.tsx');

    expect(travel).toContain('mine-surface');
    expect(travel).toContain('sa-page-header');
    expect(travel).toContain('sa-group');
    expect(travel).toContain('sa-card');
    expect(travel).toContain('读取通知里的行程');
    expect(travel).toContain('粘贴 12306');
    expect(travel).toContain('手动添加');
    expect(travel).toContain('识别并放入收件箱');
    expect(travel).toContain('onDelete');
    expect(travel).toContain('删除');
    expect(travel).toContain('self-agent:travel-updated');
    expect(travel).not.toContain('模拟解锁');
    expect(travel).not.toContain('+200ml');
  });
});
