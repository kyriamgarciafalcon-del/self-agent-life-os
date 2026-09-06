import type { ReactNode } from 'react';
import { formatHealthValue, type HomeOverviewModel } from '../../lib/home-overview-source';
import styles from './HomeOverview.module.css';

type HomeOverviewProps = {
  model: HomeOverviewModel;
  todaySpendText: string;
  recentLedger: ReactNode;
  onOpenSchedule: () => void;
  onOpenFinance: () => void;
  onOpenHealth: () => void;
  onOpenCapture: () => void;
  onOpenTravel: () => void;
  onOpenButler: () => void;
  onOpenData: () => void;
  onOpenVault: () => void;
};

export default function HomeOverview({
  model,
  todaySpendText,
  recentLedger,
  onOpenSchedule,
  onOpenFinance,
  onOpenHealth,
  onOpenCapture,
  onOpenTravel,
  onOpenButler,
  onOpenData,
  onOpenVault,
}: HomeOverviewProps) {
  const health = model.healthLatest;

  return (
    <div className={`page home-page ${styles.home}`}>
      <section className="hero-card">
        <span>{model.dateLabel}</span>
        <h2>早上好，今天慢慢来。</h2>
        <p>所有内容先整理、确认后再保存。</p>
      </section>
      <section className="summary-grid">
        <button type="button" onClick={onOpenSchedule}>
          <span>下一项 · {model.nextSchedule?.time ?? '空闲'}</span>
          <strong>{model.nextSchedule?.title ?? '今天没有更多日程'}</strong>
          <small>{model.todayDoneCount}/{model.todayTotalCount} 已完成</small>
        </button>
        <button type="button" onClick={onOpenFinance}>
          <span>今日支出</span>
          <strong>{todaySpendText}</strong>
          <small>打开账本查看明细</small>
        </button>
      </section>
      <section className="section-block">
        <div className="section-title"><div><h2>今天</h2></div></div>
        {model.todayEvents.length
          ? model.todayEvents.map((item) => (
            <button key={item.id} type="button" className={styles.event} onClick={onOpenSchedule}>
              <time>{item.time}</time>
              <div>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </div>
            </button>
          ))
          : <p className={styles.empty}>今天还没有日程</p>}
      </section>
      <section className="section-block">
        <div className="section-title"><div><h2>最近健康记录</h2></div></div>
        <button type="button" className={styles.entry} onClick={onOpenHealth}>
          {health ? (
            <div>
              <strong>{health.note || (health.kind === 'sleep' ? '睡眠' : health.kind === 'exercise' ? '运动' : '饮食')}</strong>
              <small>{formatHealthValue(health)}</small>
            </div>
          ) : (
            <div>
              <strong>还没有健康记录</strong>
              <small>打开健康页查看已有记录</small>
            </div>
          )}
        </button>
      </section>
      <section className="section-block">
        <div className="section-title"><div><h2>一句话交给管家</h2></div></div>
        <button type="button" className="capture-callout" onClick={onOpenCapture}>
          <span>＋</span>
          <div>
            <strong>记录一件事</strong>
            <small>确认后才会写入账本或日程</small>
          </div>
          <b>›</b>
        </button>
      </section>
      <section className="section-block">
        <div className="section-title"><div><h2>生活工具</h2></div></div>
        <div className="feature-grid">
          <button type="button" onClick={onOpenTravel}><span>行</span><strong>出行</strong><small>火车与航班</small></button>
          <button type="button" onClick={onOpenHealth}><span>健</span><strong>健康</strong><small>睡眠与运动</small></button>
          <button type="button" onClick={onOpenButler}><span>管</span><strong>管家</strong><small>本机摘要问答</small></button>
          <button type="button" onClick={onOpenData}><span>数</span><strong>数据</strong><small>统一趋势</small></button>
          <button type="button" onClick={onOpenVault}><span>钥</span><strong>密码库</strong><small>安全元数据</small></button>
        </div>
      </section>
      <section className="section-block">
        <div className="section-title">
          <div><h2>最近入账</h2></div>
          <button type="button" onClick={onOpenFinance}>查看全部</button>
        </div>
        {recentLedger}
      </section>
    </div>
  );
}
