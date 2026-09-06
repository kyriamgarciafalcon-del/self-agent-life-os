import { getMonthlyReport, transactionsInPeriod } from '../../../finance-query';
import { localDateKey, summarizeHealth } from '../../../product-logic';

type DataSnapshot = {
  transactions: { kind?: string; amount?: number; currency?: string; occurredAt?: string; createdAt?: string }[];
  schedules: { date: string; done: boolean }[];
  healthRecords: { kind: string; value: number; note?: string; createdAt?: string }[];
};

function money(value: number) {
  return new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function DataPage({ data }: { data: DataSnapshot }) {
  const TODAY = localDateKey();
  const MONTH = TODAY.slice(0, 7);
  const month = transactionsInPeriod(data.transactions, MONTH).filter((item) => item.currency === 'CNY');
  const monthReport = getMonthlyReport(month, 'CNY');
  const income = monthReport.income;
  const expense = monthReport.expense;
  const todayItems = data.schedules.filter((item) => item.date === TODAY);
  const healthLine = summarizeHealth(data.healthRecords);
  const hasEnough = month.length + todayItems.length + data.healthRecords.length > 0;

  return (
    <div className="page mine-surface data-page">
      <header className="sa-page-header">
        <h1>数据中心</h1>
        <p>{hasEnough ? '只汇总你确认保存过的日程、账本和健康记录，没有预测分数。' : '记录几天真实数据后，这里才会出现摘要。'}</p>
      </header>

      <p className="sa-group-header">统一摘要</p>
      <div className="sa-group">
        <div className="sa-row">
          <span className="sa-row-icon mint" aria-hidden="true">健</span>
          <span className="sa-row-text">
            <strong>健康</strong>
            <small>{data.healthRecords.length ? healthLine : '还没有健康记录'}</small>
          </span>
          <b>{data.healthRecords.length ? `${data.healthRecords.length} 条` : '—'}</b>
        </div>
        <div className="sa-row">
          <span className="sa-row-icon teal" aria-hidden="true">财</span>
          <span className="sa-row-text">
            <strong>财务</strong>
            <small>{month.length ? `收入 ¥${money(income)} · 支出 ¥${money(expense)}` : '本月还没有流水'}</small>
          </span>
          <b>{month.length ? `${month.length} 笔` : '—'}</b>
        </div>
        <div className="sa-row">
          <span className="sa-row-icon orange" aria-hidden="true">行</span>
          <span className="sa-row-text">
            <strong>行动</strong>
            <small>今日 {todayItems.length} 项日程</small>
          </span>
          <b>{todayItems.length ? `${todayItems.filter((item) => item.done).length}/${todayItems.length}` : '—'}</b>
        </div>
      </div>
      <p className="sa-page-footer">{hasEnough ? '已保存记录 · 不会编造分数。' : '暂无结论 · 不会用空数据补结论。'}</p>
    </div>
  );
}
