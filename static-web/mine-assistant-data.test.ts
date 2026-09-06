import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../app/', import.meta.url);
const page = readFileSync(new URL('page.tsx', root), 'utf8');

function source(rel: string) {
  const url = new URL(rel, root);
  expect(existsSync(url), rel).toBe(true);
  return readFileSync(url, 'utf8');
}

describe('assistant and data surface extraction', () => {
  it('keeps page.tsx as a prop bus for ButlerPage, AuditPage and DataPage', () => {
    expect(page).toContain("from './components/mine/surfaces/ButlerPage'");
    expect(page).toContain("from './components/mine/surfaces/AuditPage'");
    expect(page).toContain("from './components/mine/surfaces/DataPage'");
    expect(page).toContain('<ButlerPage');
    expect(page).toContain('<AuditPage');
    expect(page).toContain('<DataPage');
    expect(page).not.toContain('function ButlerPanel');
    expect(page).not.toContain('function AuditHistoryPanel');
    expect(page).not.toContain('function DataPanel');
  });

  it('restyles butler so writes enqueue inbox, host is confirmed, and password domain is never sent', () => {
    const butler = source('components/mine/surfaces/ButlerPage.tsx');
    expect(butler).toContain('mine-surface');
    expect(butler).toContain('sa-page-header');
    expect(butler).toContain('sa-card');
    expect(butler).toContain('sa-group');
    expect(butler).toContain('onQueueActions');
    expect(butler).toContain('onQueueTools');
    expect(butler).toContain('confirmByokHost');
    expect(butler).toContain('prepareOutboundAiPayload');
    expect(butler).toContain('精确确认');
    expect(butler).toContain('收件箱');
    expect(butler).toContain('不会发给 AI');
    expect(butler).toContain('密码');
    expect(butler).not.toContain('模拟解锁');
    expect(butler).not.toContain('••••••••');
  });

  it('restyles audit with outcome and source filters', () => {
    const audit = source('components/mine/surfaces/AuditPage.tsx');
    expect(audit).toContain('mine-surface');
    expect(audit).toContain('sa-page-header');
    expect(audit).toContain('sa-group');
    expect(audit).toContain('filterAuditLog');
    expect(audit).toContain('筛选操作结果');
    expect(audit).toContain('筛选操作来源');
    expect(audit).toContain('操作历史');
  });

  it('restyles data as real summaries without invented scores or trends', () => {
    const data = source('components/mine/surfaces/DataPage.tsx');
    expect(data).toContain('mine-surface');
    expect(data).toContain('sa-page-header');
    expect(data).toContain('sa-group');
    expect(data).toContain('sa-row');
    expect(data).toContain('统一摘要');
    expect(data).toContain('summarizeHealth');
    expect(data).toContain('getMonthlyReport');
    expect(data).not.toContain('健康评分');
    expect(data).not.toContain('评分趋势');
    expect(data).not.toContain('+200ml');
  });
});
