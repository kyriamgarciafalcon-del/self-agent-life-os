import { type FormEvent } from 'react';
import { addDaysKey } from '../../product-logic';
import { dayOffsetFromToday, formatMonthDay, schedulesOnOffset } from './schedule';

export type DailyScheduleItem = {
  id: string;
  date: string;
  time: string;
  title: string;
  detail: string;
};

export function SchedulePage({
  today,
  selectedDate,
  schedules,
  editing,
  formOpen,
  onSelectDate,
  onNew,
  onEdit,
  onCloseForm,
  onSubmit,
  onDelete,
}: {
  today: string;
  selectedDate: string;
  schedules: DailyScheduleItem[];
  editing?: DailyScheduleItem;
  formOpen: boolean;
  onSelectDate: (date: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onCloseForm: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (id: string) => void;
}) {
  const offset = dayOffsetFromToday(selectedDate, today);
  const dayItems = schedulesOnOffset(schedules, selectedDate);
  const dayLabel = formatMonthDay(selectedDate);

  return (
    <div className="page schedule-page">
      <div className="daily-segment" role="tablist" aria-label="选择日期">
        <button type="button" className={offset === -1 ? 'on' : ''} onClick={() => onSelectDate(addDaysKey(today, -1))}>昨天</button>
        <button type="button" className={offset === 0 ? 'on' : ''} onClick={() => onSelectDate(today)}>今天</button>
        <button type="button" className={offset === 1 ? 'on' : ''} onClick={() => onSelectDate(addDaysKey(today, 1))}>明天</button>
      </div>
      {Math.abs(offset) > 1 ? (
        <button type="button" className="daily-plain" onClick={() => onSelectDate(today)}>回到今天 · 也可点「前/后」继续浏览</button>
      ) : (
        <div className="daily-day-nav">
          <button type="button" onClick={() => onSelectDate(addDaysKey(selectedDate, -1))}>前一天</button>
          <button type="button" onClick={() => onSelectDate(addDaysKey(selectedDate, 1))}>后一天</button>
        </div>
      )}
      <h2 className="daily-group-header">{dayLabel} · {dayItems.length} 项</h2>
      <div className="daily-group">
        {dayItems.length === 0 ? (
          <div className="daily-empty">
            <p>这一天没有日程</p>
            <button type="button" onClick={onNew}>添加日程</button>
          </div>
        ) : (
          <div className="daily-timeline">
            {dayItems.map((item, index) => (
              <div className={`daily-row ${index > 0 ? 'daily-row-sep' : ''}`} key={item.id}>
                <button type="button" className="daily-row-main" onClick={() => onEdit(item.id)}>
                  <div className="daily-time">
                    <strong>{item.time}</strong>
                  </div>
                  <div className="daily-row-body">
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </div>
                </button>
                <button type="button" className="daily-delete" onClick={() => onDelete(item.id)} aria-label="删除">删除</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="daily-fab" onClick={onNew} aria-label="新建日程">＋</button>

      {formOpen && (
        <div className="overlay" role="dialog" aria-modal="true" onMouseDown={(event) => event.currentTarget === event.target && onCloseForm()}>
          <form key={editing?.id ?? 'new-schedule'} onSubmit={onSubmit} className="sheet">
            <div className="handle" />
            <header>
              <div>
                <span>{editing ? 'EDIT SCHEDULE' : 'NEW SCHEDULE'}</span>
                <h2>{editing ? '编辑日程' : '新建日程'}</h2>
              </div>
              <button type="button" onClick={onCloseForm}>×</button>
            </header>
            <label>日程名称<input required autoFocus name="title" placeholder="例如：准备周末徒步装备" defaultValue={editing?.title} /></label>
            <div className="row">
              <label>日期<input required name="date" type="date" defaultValue={editing?.date ?? selectedDate} /></label>
              <label>时间<input required name="time" type="time" defaultValue={editing?.time ?? '10:00'} /></label>
            </div>
            <label>类型<input name="detail" placeholder="个人、工作或健康" defaultValue={editing?.detail?.split(' · ')[0] ?? '个人'} /></label>
            <small className="form-tip">会提前 10 分钟弹一次，到点再弹一次。请允许通知。</small>
            <button className="save" type="submit">{editing ? '保存修改' : '确认添加'}</button>
            {editing && <button className="danger-button" type="button" onClick={() => onDelete(editing.id)}>删除这条日程</button>}
          </form>
        </div>
      )}
    </div>
  );
}
