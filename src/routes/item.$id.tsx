import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { EventForm } from "@/components/event-form";
import { PageHead, Panel } from "@/components/bits";
import { formatWhen, isDone, TAG_LABEL, todayKey } from "@/lib/agenda";
import { useAgenda } from "@/lib/store";

export const Route = createFileRoute("/item/$id")({ component: ItemPage });

function ItemPage() {
  const { id } = Route.useParams();
  const item = useAgenda((s) => s.items.find((it) => it.id === id));
  const updateItem = useAgenda((s) => s.updateItem);
  const removeItem = useAgenda((s) => s.removeItem);
  const toggleDone = useAgenda((s) => s.toggleDone);
  const navigate = useNavigate();
  const today = todayKey();
  if (!item) {
    return (<div><PageHead title="日程" back /><Panel className="py-10 text-center text-sm">这条日程已经不在了</Panel></div>);
  }
  const done = isDone(item, today);
  return (
    <div>
      <PageHead title="编辑" caption={item.date ? formatWhen(item.date, today) : "未定日期"} back />
      <Panel className="mb-4">
        <p className="text-[11px] text-muted-foreground">{TAG_LABEL[item.tag]} · {done ? "已完成" : "未完成"}</p>
        <button type="button" className="mt-2 min-h-11 rounded-xl bg-secondary px-3 text-xs font-semibold text-brand-deep" onClick={() => { toggleDone(item.id, today); toast(done ? "已恢复为未完成" : "已完成"); }}>
          {done ? "标为未完成" : "标为完成"}
        </button>
      </Panel>
      <EventForm
        key={item.id}
        initial={{ title: item.title, note: item.note, date: item.date, start: item.start, end: item.end, allDay: item.allDay, repeat: item.repeat, tag: item.tag, kind: item.kind }}
        submitLabel="保存修改"
        onSubmit={(draft) => { updateItem(item.id, draft); toast("已保存"); void navigate({ to: "/" }); }}
        onDelete={() => { removeItem(item.id); toast("已删除"); void navigate({ to: "/" }); }}
      />
    </div>
  );
}
