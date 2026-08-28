import { createFileRoute } from "@tanstack/react-router";
import { Fingerprint, Lock, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHead, Panel, Section } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useVault } from "@/lib/vault-store";

export const Route = createFileRoute("/vault")({ component: VaultPage });

function VaultPage() {
  const items = useVault((s) => s.items);
  const unlocked = useVault((s) => s.unlocked);
  const unlock = useVault((s) => s.unlock);
  const lock = useVault((s) => s.lock);
  const add = useVault((s) => s.add);
  const remove = useVault((s) => s.remove);
  const [reveal, setReveal] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [title, setTitle] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [siteForm, setSiteForm] = useState({ user: "", pass: "" });
  const [capture, setCapture] = useState<{ user: string; pass: string } | null>(null);

  if (!unlocked) {
    return (
      <div>
        <PageHead title="密码库" caption="独立安全域" back />
        <div className="px-2 py-6 text-center">
          <div className="mx-auto mb-4 grid size-20 place-items-center rounded-[27px] bg-secondary text-primary">
            <Lock className="size-9" />
          </div>
          <h2 className="text-[21px] font-semibold">密码库已锁定</h2>
          <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
            凭据只存在本机。管家只能知道某个站点有没有账号，永远读不到密码明文。
          </p>
          <Button className="mt-5 h-11 rounded-xl" onClick={() => { unlock(); toast("本机验证通过；凭据仍保持遮挡"); }}>
            <Fingerprint className="size-4" />
            解锁查看条目
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHead title="密码库" caption={`${items.length}项 · 已解锁`} back right={
        <button type="button" className="min-h-11 text-xs font-semibold text-primary" onClick={lock}>锁定</button>
      } />
      <div className="mb-4 flex gap-2 rounded-[14px] border border-warn/20 bg-muted px-3 py-3 text-[10px] leading-relaxed text-ink">
        <Shield className="size-4 shrink-0 text-warn" />
        网页演示用解锁门闪。安卓上会走系统自动填充服务，密钥存在系统密钥库，不进账本。
      </div>
      <Section title="已保存账号" hint="点查看才短暂显示密码">
        <Panel className="py-1">
          {items.map((v) => (
            <div key={v.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
              <div className="grid size-10 place-items-center rounded-[14px] bg-muted text-[14px] font-semibold text-primary">{(v.title || "账").slice(0, 1)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">{v.title}</p>
                <p className="text-[10px] text-muted-foreground">{v.username} · {reveal === v.id && v.password ? v.password : v.password ? "••••••••" : "无密码明文"}</p>
              </div>
              <button type="button" className="min-h-11 px-2 text-[11px] font-semibold text-primary" onClick={() => {
                if (!v.password) { toast("这条只有账号，没有存密码"); return; }
                setReveal(reveal === v.id ? null : v.id);
              }}>{reveal === v.id ? "隐藏" : "查看"}</button>
              <button type="button" className="min-h-11 px-2 text-[11px] font-semibold text-destructive" onClick={() => remove(v.id)}>删</button>
            </div>
          ))}
        </Panel>
      </Section>
      <Button variant="secondary" className="mt-3 h-11 w-full rounded-xl" onClick={() => setForm(true)}>手动收录</Button>
      <Section title="模拟网站登录" hint="对应安卓 Autofill 的「保存到 self-agent」">
        <Panel>
          <form className="space-y-3" autoComplete="off" onSubmit={(e) => {
            e.preventDefault();
            if (!siteForm.user || !siteForm.pass) { toast("先输入账号和密码"); return; }
            setCapture({ ...siteForm });
          }}>
            <div className="space-y-1.5"><Label htmlFor="site-user">用户名</Label><Input id="site-user" name="username" value={siteForm.user} onChange={(e) => setSiteForm((s) => ({ ...s, user: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="site-pass">密码</Label><Input id="site-pass" name="password" type="password" value={siteForm.pass} onChange={(e) => setSiteForm((s) => ({ ...s, pass: e.target.value }))} /></div>
            <Button type="submit" className="h-11 w-full rounded-xl">登录并询问是否保存</Button>
          </form>
        </Panel>
      </Section>
      <Dialog open={form} onOpenChange={setForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>手动收录</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !username.trim()) { toast("名称和账号必填"); return; }
            add({ title: title.trim(), username: username.trim(), password, note: "本机保存", source: "manual" });
            setTitle(""); setUsername(""); setPassword(""); setForm(false);
            toast("已收入密码库，未写入财务");
          }}>
            <Input placeholder="站点 / App" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="账号" value={username} onChange={(e) => setUsername(e.target.value)} />
            <Input placeholder="密码（可空）" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button type="submit" className="h-11 w-full rounded-xl">确认保存</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(capture)} onOpenChange={(v) => !v && setCapture(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>保存到 self-agent？</DialogTitle></DialogHeader>
          <p className="text-xs leading-relaxed text-muted-foreground">来源：示例站点。账号 {capture?.user}。密码不会进入账本或对话。</p>
          <div className="flex gap-2">
            <Button className="h-11 flex-1 rounded-xl" onClick={() => {
              if (!capture) return;
              add({ title: "示例站点", username: capture.user, password: capture.pass, note: "自动填充收录", source: "autofill" });
              setSiteForm({ user: "", pass: "" }); setCapture(null); toast("已保存到密码库");
            }}>保存</Button>
            <Button variant="outline" className="h-11 rounded-xl" onClick={() => setCapture(null)}>不保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
