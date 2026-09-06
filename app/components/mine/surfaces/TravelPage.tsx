import { FormEvent, useState } from 'react';
import { localDateKey } from '../../../product-logic';
import { MineCard, SettingsGroup, SettingsRow } from '../primitives';

type TravelItem = {
  id: string;
  kind: 'train' | 'flight';
  number: string;
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
  seat: string;
  terminal: string;
  status: 'upcoming' | 'completed' | 'changed';
  source: 'manual' | 'calendar' | 'notification' | 'import';
  verified: boolean;
};

const TODAY = localDateKey();

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function parseTravelText(text: string): TravelItem | null {
  const raw = text.replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const train = raw.match(/([GDCZTK]\d{1,5})次?/);
  const flight = raw.match(/\b([A-Z]{2}\d{3,4})\b/i);
  const resolvedKind: TravelItem['kind'] | null = train ? 'train' : (flight && /航班|起飞|登机|机场/.test(raw) ? 'flight' : null);
  if (!resolvedKind) return null;
  const number = (train?.[1] || flight?.[1] || '').toUpperCase();
  const route = raw.match(/([\u4e00-\u9fa5]{2,12}?)(?:站|机场)?\s*[-—至到]\s*([\u4e00-\u9fa5]{2,12}?)(?:站|机场)?/);
  const dateMatch = raw.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/);
  const year = dateMatch?.[1] || TODAY.slice(0, 4);
  const month = dateMatch ? String(dateMatch[2]).padStart(2, '0') : TODAY.slice(5, 7);
  const day = dateMatch ? String(dateMatch[3]).padStart(2, '0') : TODAY.slice(8, 10);
  const times = [...raw.matchAll(/(\d{1,2}:\d{2})/g)].map((item) => item[1]);
  const date = `${year}-${month}-${day}`;
  const seat = raw.match(/(\d{1,2}车\s*\d{1,3}[A-F]?)/)?.[1] || '待分配';
  const terminal = raw.match(/检票口\s*([A-Z]?\d{1,3}[A-Z]?)/)?.[1] || raw.match(/(?:航站楼|登机口)\s*([A-Z]?\d{1,2}[A-Z]?)/)?.[1] || '待确认';
  return {
    id: uid('travel'),
    kind: resolvedKind,
    number,
    from: route?.[1] || '待确认',
    to: route?.[2] || '待确认',
    departAt: `${date}T${times[0] || '08:00'}`,
    arriveAt: `${date}T${times[1] || times[0] || '12:00'}`,
    seat,
    terminal,
    status: 'upcoming',
    source: 'import',
    verified: false,
  };
}

export function TravelPage({
  items,
  onSync,
  onAdd,
  onDelete,
}: {
  items: TravelItem[];
  onSync: () => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...items].sort((a, b) => a.departAt.localeCompare(b.departAt));
  const next = sorted.find((item) => item.status !== 'completed');
  const [paste, setPaste] = useState('');

  function time(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value.replace('T', ' ') : new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function submitPaste(event: FormEvent) {
    event.preventDefault();
    const trip = parseTravelText(paste);
    if (!trip) return;
    window.dispatchEvent(new CustomEvent('self-agent:travel-updated', { detail: [trip] }));
    setPaste('');
  }

  return (
    <div className="page mine-surface travel-page">
      <header className="sa-page-header">
        <h1>出行</h1>
        <p>{next ? `${next.from} → ${next.to} · ${next.number} · ${time(next.departAt)}` : '可以粘贴 12306/航司短信，或授权通知读取。'}</p>
      </header>

      <SettingsGroup title="添加行程">
        <SettingsRow mark="通" tone="mint" title="读取通知里的行程" subtitle="12306、航旅纵横、短信通知" onClick={onSync} />
        <SettingsRow mark="＋" tone="teal" title="手动添加" subtitle="补充车次、航班和座位" onClick={onAdd} />
      </SettingsGroup>

      <MineCard>
        <form onSubmit={submitPaste}>
          <strong>粘贴 12306 / 航班短信</strong>
          <label className="sa-label">
            短信内容
            <textarea value={paste} onChange={(event) => setPaste(event.target.value)} rows={3} placeholder="例如：您已购8月29日G123次北京南站-上海虹桥站" />
          </label>
          <div className="sa-actions">
            <button className="sa-btn sa-btn-primary save" type="submit">识别并放入收件箱</button>
          </div>
        </form>
      </MineCard>

      <p className="sa-group-header">火车与航班</p>
      {sorted.length ? sorted.map((item) => (
        <article key={item.id} className={`sa-card trip-card ${item.status}`}>
          <header className="trip-card-head">
            <strong>{item.kind === 'flight' ? '航班' : '火车'} · {item.number}</strong>
            <small>{item.source === 'notification' ? '通知识别' : item.source === 'manual' ? '手动添加' : '粘贴识别'}</small>
          </header>
          <div className="trip-route">
            <div><strong>{item.from}</strong><small>{time(item.departAt)}</small></div>
            <i>→</i>
            <div><strong>{item.to}</strong><small>{time(item.arriveAt)}</small></div>
          </div>
          <p className="trip-meta">{item.seat} · {item.terminal} · {item.source === 'manual' ? '手动' : item.source === 'notification' ? '通知' : '导入'}</p>
          <div className="sa-actions">
            <button type="button" className="sa-btn sa-btn-danger" onClick={() => onDelete(item.id)}>删除</button>
          </div>
        </article>
      )) : (
        <div className="sa-group">
          <div className="sa-row">
            <span className="sa-row-text">
              <strong>还没有行程</strong>
              <small>粘贴短信或打开通知使用权后等待识别。</small>
            </span>
          </div>
        </div>
      )}

      <p className="sa-page-footer">铁路 12306 没有对第三方开放「我的车票」官方接口。不能用破解或模拟登录去拉你的订单。航班动态可用航旅纵横、飞常准等官方渠道；本 App 先识别你已经收到的出票通知。</p>
    </div>
  );
}
