import { FormEvent, useState } from 'react';
import {
  buildHealthMetricSeries,
  formatCompactSleepDuration,
  formatSleepDuration,
  sleepDurationParts,
  type HealthCoreKind,
  type HealthMetricSeries,
} from '../../../health-dashboard';
import { latestHealthByKind, localDateKey } from '../../../product-logic';
import { MineCard, SettingsGroup, SettingsRow } from '../primitives';

type HealthRecord = {
  id: string;
  kind: 'sleep' | 'meal' | 'exercise' | 'steps' | 'height' | 'weight' | 'heartRate' | 'stress' | 'pai';
  value: number;
  note: string;
  createdAt: string;
  externalKey?: string;
};

const TODAY = localDateKey();

function HealthTrendBars({ series }: { series: HealthMetricSeries }) {
  if (!series.points.length) {
    return <div className="health-trend-empty">暂无趋势数据。同步或手动添加记录后，这里会显示真实日期。</div>;
  }
  const values = series.points.map((point) => point.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min;
  return (
    <div className="health-trend-bars" role="img" aria-label={`${series.label}最近 7 个有记录日期的趋势`}>
      {series.points.map((point) => {
        const height = span === 0 ? 58 : 28 + ((point.value - min) / span) * 58;
        return (
          <div className="health-trend-point" key={point.date}>
            <strong aria-label={series.kind === 'sleep' ? formatSleepDuration(point.value) : undefined}>
              {series.kind === 'sleep' ? formatCompactSleepDuration(point.value) : point.value}
            </strong>
            <i style={{ height: `${height}%` }} />
            <small>{point.date.slice(5).replace('-', '/')}</small>
          </div>
        );
      })}
    </div>
  );
}

function HealthMetricValue({ series }: { series: HealthMetricSeries }) {
  if (!series.latest) return <strong>暂无数据</strong>;
  if (series.kind !== 'sleep') return <strong>{series.displayValue}</strong>;
  const { hours, minutes } = sleepDurationParts(series.latest.value);
  return (
    <strong className="sleep-duration" aria-label={series.displayValue}>
      <span className="sleep-number">{hours}</span>
      <span className="sleep-unit">小时</span>
      <span className="sleep-number">{minutes}</span>
      <span className="sleep-unit">分钟</span>
    </strong>
  );
}

export function HealthPage({
  records,
  onAdd,
  onImportHealthConnect,
  onImportGadgetbridge,
  onSelectExport,
  onExportDiagnostics,
  onSaveBody,
}: {
  records: HealthRecord[];
  onAdd: () => void;
  onImportHealthConnect: () => void;
  onImportGadgetbridge: () => void;
  onSelectExport: () => void;
  onExportDiagnostics: () => void;
  onSaveBody: (height: number, weight: number) => void;
}) {
  const kinds: HealthCoreKind[] = ['steps', 'sleep', 'heartRate', 'stress', 'pai'];
  const marks: Record<string, string> = { height: '高', weight: '重', heartRate: '心', stress: '压', sleep: '睡', pai: 'P', steps: '步', exercise: '动', meal: '食' };
  const series = kinds.map((kind) => buildHealthMetricSeries(records, kind));
  const [selectedKind, setSelectedKind] = useState<HealthCoreKind>('steps');
  const selected = series.find((item) => item.kind === selectedKind) ?? series[0];
  const currentHeight = latestHealthByKind(records, 'height');
  const currentWeight = latestHealthByKind(records, 'weight');
  const [editingBody, setEditingBody] = useState(false);
  const history = [...records].filter((item) => Number.isFinite(item.value)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  const latestDate = series.map((item) => item.latest?.date || '').sort().at(-1) || '';

  function formatRecord(kind: string, value: number) {
    if (kind === 'height') return `${value} cm`;
    if (kind === 'weight') return `${value} kg`;
    if (kind === 'heartRate') return `${value} 次/分`;
    if (kind === 'sleep') return formatSleepDuration(value);
    if (kind === 'exercise') return `${value} 分钟`;
    if (kind === 'meal') return `${value} 餐`;
    if (kind === 'steps') return `${value} 步`;
    if (kind === 'stress' || kind === 'pai') return `${value} 原始分`;
    return String(value);
  }

  function dateLabel(value: string) {
    if (!value) return '暂无记录';
    if (value === TODAY) return '今天';
    return `${Number(value.slice(5, 7))}月${Number(value.slice(8, 10))}日`;
  }

  function submitBody(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const height = Number(form.get('height'));
    const weight = Number(form.get('weight'));
    if (!(height > 0) || !(weight > 0)) return;
    onSaveBody(height, weight);
    setEditingBody(false);
  }

  return (
    <div className="page mine-surface health-page">
      <header className="sa-page-header">
        <h1>健康</h1>
        <p>{latestDate ? `最近数据更新于 ${dateLabel(latestDate)}` : '暂无今日记录，先同步设备或添加一条记录。'}</p>
      </header>

      <MineCard>
        <h2>今日状态</h2>
        <div className="health-status" role="region" aria-label="今日健康状态">
          {series.slice(0, 3).map((item) => (
            <article key={item.kind}>
              <span aria-hidden="true">{marks[item.kind]}</span>
              <div>
                <small>{item.label}</small>
                <HealthMetricValue series={item} />
                <em>{item.latest ? `${item.unit ? `${item.unit} · ` : ''}${dateLabel(item.latest.date)}` : '待记录'}</em>
              </div>
            </article>
          ))}
        </div>
      </MineCard>

      <h2 className="sa-group-header">7 日趋势</h2>
      <MineCard>
        <p className="sa-card-kicker">仅显示有记录的日期，缺日不补 0</p>
        <div className="health-metric-tabs" role="tablist" aria-label="选择趋势指标">
          {series.map((item) => (
            <button
              key={item.kind}
              type="button"
              role="tab"
              aria-selected={selectedKind === item.kind}
              aria-controls="health-trend-panel"
              className={selectedKind === item.kind ? 'active' : ''}
              onClick={() => setSelectedKind(item.kind)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div id="health-trend-panel" role="tabpanel">
          <div className="health-trend-summary">
            <div>
              <HealthMetricValue series={selected} />
              <span>{selected.latest ? selected.unit : ''}</span>
            </div>
            <small>{selected.latest ? `最近一次 · ${dateLabel(selected.latest.date)} · ${selected.latest.source} · 本机保存` : '暂无数据，不会补零或推测'}</small>
          </div>
          <HealthTrendBars series={selected} />
        </div>
      </MineCard>

      <p className="sa-group-header">核心指标</p>
      <div className="sa-group health-core-group">
        {series.map((item) => (
          <button type="button" className="sa-row" key={item.kind} onClick={() => setSelectedKind(item.kind)} aria-label={`查看${item.label}趋势`}>
            <span className="sa-row-icon mint" aria-hidden="true">{marks[item.kind]}</span>
            <span className="sa-row-text">
              <strong>{item.label}</strong>
              <small>{item.latest ? `${item.unit ? `${item.unit} · ` : ''}${dateLabel(item.latest.date)}` : '待记录'}</small>
            </span>
            <span className="health-core-value"><HealthMetricValue series={item} /></span>
          </button>
        ))}
      </div>
      <div className="health-raw-score-notes">
        <p><strong>压力：</strong><span>手环原始分 · 无医学单位</span></p>
        <p><strong>PAI：</strong><span>手环原始分 · 无医学单位</span></p>
      </div>

      <p className="sa-group-header">最近记录</p>
      <div className="sa-group">
        {history.length ? history.map((item) => (
          <div className="sa-row" key={item.id}>
            <span className="sa-row-icon teal" aria-hidden="true">{marks[item.kind] || '健'}</span>
            <span className="sa-row-text">
              <strong>{item.note || '健康记录'}</strong>
              <small>{dateLabel(item.createdAt.slice(0, 10))} · {item.createdAt.slice(11, 16) || '全天'}</small>
            </span>
            <b className="health-history-value">{formatRecord(item.kind, item.value)}</b>
          </div>
        )) : (
          <div className="sa-row">
            <span className="sa-row-text">
              <strong>还没有健康记录</strong>
              <small>可从 Health Connect、Gadgetbridge 导入，或手动添加。</small>
            </span>
          </div>
        )}
      </div>

      <div className="health-data-management">
        <SettingsGroup title="数据管理">
          <SettingsRow mark="H" tone="mint" title="Health Connect" subtitle="同步身高、体重、心率、睡眠和步数" onClick={onImportHealthConnect} />
          <SettingsRow mark="G" tone="teal" title="Gadgetbridge" subtitle="读取已授权的数据库或完整 ZIP" onClick={onImportGadgetbridge} />
          <SettingsRow mark="夹" tone="orange" title="选择 ZIP 文件夹" subtitle="跟踪新生成的 Gadgetbridge.zip" onClick={onSelectExport} />
          <SettingsRow mark="查" tone="gray" title="导出导入排障" subtitle="仅排查导入，不是医疗诊断" onClick={onExportDiagnostics} />
        </SettingsGroup>
      </div>
      <div className="sa-actions mine-surface-actions">
        <button type="button" className="sa-btn sa-btn-primary" onClick={onAdd}>＋ 手动添加健康记录</button>
      </div>

      <div className="health-body-panel">
        <MineCard>
          <strong>身体资料</strong>
          {currentHeight != null && currentWeight != null && !editingBody ? (
            <div className="body-profile-summary">
              <div><small>身高</small><strong>{currentHeight} cm</strong></div>
              <div><small>体重</small><strong>{currentWeight} kg</strong></div>
              <button type="button" className="sa-btn sa-btn-secondary" onClick={() => setEditingBody(true)}>修改</button>
            </div>
          ) : (
            <form className="body-profile-form" onSubmit={submitBody}>
              <label className="sa-label">身高（cm）<input required name="height" type="number" min="50" max="250" step="0.1" defaultValue={currentHeight ?? ''} /></label>
              <label className="sa-label">体重（kg）<input required name="weight" type="number" min="10" max="400" step="0.1" defaultValue={currentWeight ?? ''} /></label>
              <button className="sa-btn sa-btn-primary save" type="submit">保存身体资料</button>
            </form>
          )}
        </MineCard>
      </div>

      <p className="sa-page-footer">这些数据不是诊断，不能替代医疗意见。只有在“健康摘要”隐私权限开启时，管家才可读取摘要；密码和原始数据库不会发送给 AI。</p>
    </div>
  );
}
