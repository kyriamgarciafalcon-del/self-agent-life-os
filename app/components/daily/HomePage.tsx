import type { ReactNode } from 'react';
import { LargeTitle } from '../../ui';
import { HOME_SHORTCUTS, type HomeShortcutId } from './home';

export type HomeInboxPreview = {
  id: string;
  preview: string;
  sourceLabel: string;
  actionLabel: string;
  confidenceLabel: string;
};

export type HomeSchedulePreview = {
  id: string;
  time: string;
  title: string;
  detail: string;
};

export function HomePage({
  demoMode,
  todayLabel,
  greeting,
  inboxPending,
  inboxPendingCount,
  hasBusinessData,
  hasFinanceData,
  nativeOn,
  caps,
  todaySchedules,
  todaySpendLabel,
  netWorthLabel,
  recentCount,
  recentLedger,
  onClearDemo,
  onNavigate,
  onAddFirstSchedule,
  onAddFirstAccount,
}: {
  demoMode: boolean;
  todayLabel: string;
  greeting: string;
  inboxPending: HomeInboxPreview[];
  inboxPendingCount: number;
  hasBusinessData: boolean;
  hasFinanceData: boolean;
  nativeOn: boolean;
  caps: { accessibility?: boolean | null; notificationListener?: boolean | null; autofill?: boolean | null };
  todaySchedules: HomeSchedulePreview[];
  todaySpendLabel: string;
  netWorthLabel: string;
  recentCount: number;
  recentLedger: ReactNode;
  onClearDemo: () => void;
  onNavigate: (tab: HomeShortcutId | 'schedule' | 'finance' | 'profile' | 'capture') => void;
  onAddFirstSchedule: () => void;
  onAddFirstAccount: () => void;
}) {
  return (
    <div className="page home-page">
      {demoMode && (
        <section className="demo-banner">
          <strong>当前为演示数据</strong>
          <span>以下资产、日程和健康记录不代表你的真实信息。</span>
          <button type="button" onClick={onClearDemo}>退出演示并清空</button>
        </section>
      )}
      <LargeTitle kicker={todayLabel} title={greeting}>
        <p>所有内容先整理、确认后再保存。</p>
      </LargeTitle>
      {inboxPendingCount > 0 && (
        <section className="inbox-home">
          <h2 className="daily-group-header">待确认</h2>
          <div className="daily-group">
            <button type="button" className="daily-row" onClick={() => onNavigate('capture')}>
              <div className="daily-row-body">
                <strong>待确认 {inboxPendingCount} 条</strong>
                <small>确认后才会写入正式数据</small>
              </div>
            </button>
            {inboxPending.map((item, index) => (
              <button type="button" className={`inbox-home-card daily-row ${index >= 0 ? 'daily-row-sep' : ''}`} key={item.id} onClick={() => onNavigate('capture')}>
                <div className="daily-row-body">
                  <strong>{item.preview}</strong>
                  <small>{item.sourceLabel} · 置信度 {item.confidenceLabel} · {item.actionLabel}</small>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      {!hasBusinessData && (
        <section className="onboarding-card">
          <span>从一件真实的事开始</span>
          <h2>这里还没有你的数据</h2>
          <p>不用一次授权全部功能。先添加一个日程或账户，其他能力需要时再开启。</p>
          <div>
            <button type="button" onClick={onAddFirstSchedule}>添加第一条日程</button>
            <button type="button" onClick={onAddFirstAccount}>添加第一个账户</button>
          </div>
        </section>
      )}
      {nativeOn && (!caps.accessibility || !caps.notificationListener || !caps.autofill) && (
        <section className="capability-card">
          <strong>系统能力状态</strong>
          <p>无障碍自动记账：{caps.accessibility ? '已开启' : '未开启'}。通知读取：{caps.notificationListener ? '已开启' : '未开启'}。自动填充：{caps.autofill ? '已设为 Self Agent' : '未选择'}。打开设置后回到这里会重新检测，不会把“已打开设置页”当成已启用。</p>
          <button type="button" onClick={() => onNavigate('profile')}>去授权并复查</button>
        </section>
      )}
      <h2 className="daily-group-header">今日摘要</h2>
      <div className="daily-group">
        {todaySchedules.length === 0 ? (
          <div className="daily-empty">
            <p>今天暂无日程</p>
            <p>在「日程」添加，或从「记录」确认草稿</p>
            <button type="button" onClick={() => onNavigate('schedule')}>查看日程</button>
          </div>
        ) : (
          todaySchedules.map((item, index) => (
            <button type="button" className={`daily-row ${index > 0 ? 'daily-row-sep' : ''}`} key={item.id} onClick={() => onNavigate('schedule')}>
              <div className="daily-time">
                <strong>{item.time}</strong>
              </div>
              <div className="daily-row-body">
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </div>
            </button>
          ))
        )}
        {hasFinanceData ? (
          <button type="button" className={`daily-row ${todaySchedules.length ? 'daily-row-sep' : ''}`} onClick={() => onNavigate('finance')}>
            <div className="daily-row-body">
              <span>今日支出</span>
              <strong>{todaySpendLabel}</strong>
              <small>净资产 {netWorthLabel}</small>
            </div>
          </button>
        ) : null}
      </div>
      <h2 className="daily-group-header">快捷入口</h2>
      <div className="daily-group">
        {HOME_SHORTCUTS.map((item, index) => (
          <button type="button" className={`daily-row ${index > 0 ? 'daily-row-sep' : ''}`} key={item.id} onClick={() => onNavigate(item.id)}>
            <div className="daily-row-body">
              <strong>{item.title}</strong>
              <small>{item.hint}</small>
            </div>
          </button>
        ))}
      </div>
      <section className="section-block">
        <div className="section-title">
          <h2 className="daily-group-header">最近入账</h2>
          <button type="button" onClick={() => onNavigate('finance')}>查看全部</button>
        </div>
        {recentCount === 0 ? <div className="daily-empty">暂无入账</div> : recentLedger}
      </section>
    </div>
  );
}
