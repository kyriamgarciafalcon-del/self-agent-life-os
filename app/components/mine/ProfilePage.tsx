import type { ChangeEvent, FormEvent } from 'react';
import type { PaymentCaptureSnapshot } from '../../product-logic';
import { HowToNative } from './HowToNative';
import { GroupedList, LargeTitle } from '../../ui';
import { MineCard, SettingsGroup, SettingsRow } from './primitives';

export type MineTab = 'life' | 'audit' | 'memory' | 'privacy' | 'vault' | 'data';

const EMPTY_PAYMENT_CAPTURE_SNAPSHOT: PaymentCaptureSnapshot = {
  active: false,
  serviceStarts: 0, accessibilityEvents: 0, scans: 0, nonEmptyScans: 0,
  matches: 0, parsed: 0, duplicates: 0, notificationsSubmitted: 0,
  lastOutcome: 'idle', lastPackage: 'unknown', lastEventType: 0, lastTextLength: 0,
};
const PAYMENT_CAPTURE_OUTCOME_LABELS: Record<PaymentCaptureSnapshot['lastOutcome'], string> = {
  idle: '尚无扫描',
  empty: '事件到达，但没有读到界面文字',
  'password-screen': '密码或验证码页面，按规则跳过',
  'no-match': '读到文字，但支付规则未命中',
  parsed: '已解析为待确认草稿',
  'duplicate-local': '重复界面事件，已去重',
  'duplicate-guard': '已由交易去重器拦截',
  notified: '已向系统提交记账通知',
  'notification-blocked': '系统未允许提交记账通知',
};
const PAYMENT_CAPTURE_SOURCE_LABELS: Record<PaymentCaptureSnapshot['lastPackage'], string> = {
  wechat: '微信', alipay: '支付宝', unionpay: '云闪付', unknown: '无来源',
};

export function ProfilePage({
  theme,
  nativeOn,
  aiConfig,
  caps,
  onResetPaymentDiagnostics,
  onStopPaymentDiagnostics,
  onNavigate,
  onOpenPermissions,
  onChooseZip,
  onSaveAi,
  onTestAi,
  onOpenAccessibility,
  onOpenNotification,
  onOpenAutofill,
  onToggleTheme,
  onExport,
  onImport,
  onNativeImport,
  onLoadDemo,
  onClear,
}: {
  theme: 'light' | 'dark';
  nativeOn: boolean;
  aiConfig: { baseUrl: string; model: string; apiKey: string; configured: boolean };
  caps: { accessibility?: boolean | null; notifications?: boolean | null; notificationListener?: boolean | null; paymentCapture?: PaymentCaptureSnapshot };
  onResetPaymentDiagnostics: () => void;
  onStopPaymentDiagnostics: () => void;
  onNavigate: (tab: MineTab) => void;
  onOpenPermissions: () => void;
  onChooseZip: () => void;
  onSaveAi: (next: { baseUrl: string; model: string; apiKey: string }) => void;
  onTestAi: () => void;
  onOpenAccessibility: () => void;
  onOpenNotification: () => void;
  onOpenAutofill: () => void;
  onToggleTheme: () => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onNativeImport: () => void;
  onLoadDemo: () => void;
  onClear: () => void;
}) {
  function submitAi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSaveAi({
      baseUrl: String(form.get('baseUrl')).trim().replace(/\/$/, ''),
      model: String(form.get('model')).trim() || 'gpt-4o-mini',
      apiKey: String(form.get('apiKey') ?? '').trim(),
    });
  }
  const diagnostic = caps.paymentCapture ?? EMPTY_PAYMENT_CAPTURE_SNAPSHOT;

  return (
    <div className="page profile-page">
      <LargeTitle title="我的"><p>设置与扩展</p></LargeTitle>
      <GroupedList>
        <SettingsGroup title="功能">
          <SettingsRow mark="生" tone="mint" title="生活" subtitle="健康、出行和记忆" onClick={() => onNavigate('life')} />
          <SettingsRow mark="权" tone="teal" title="系统权限引导" subtitle="查看真实授权状态与用途说明" onClick={onOpenPermissions} />
          <SettingsRow mark="史" tone="gray" title="操作历史" subtitle="收件箱确认、忽略、撤销与失败记录" onClick={() => onNavigate('audit')} />
          <SettingsRow mark="链" tone="orange" title="选择 ZIP 所在文件夹" subtitle="请选择 Download/health，自动跟踪新生成的 Gadgetbridge.zip" onClick={onChooseZip} />
        </SettingsGroup>

        <SettingsGroup title="数据与隐私">
          <SettingsRow mark="忆" tone="ink" title="AI 记忆管理" subtitle="查看、暂停或删除管家记忆" onClick={() => onNavigate('memory')} />
          <SettingsRow mark="盾" tone="teal" title="隐私与权限" subtitle="分别控制健康、财务和日程摘要" onClick={() => onNavigate('privacy')} />
          <SettingsRow mark="钥" tone="gray" title="密码库" subtitle="不在网页保存密码明文" onClick={() => onNavigate('vault')} />
          <SettingsRow mark="数" tone="mint" title="数据中心" subtitle="健康、财务与行动统一摘要" onClick={() => onNavigate('data')} />
        </SettingsGroup>
      </GroupedList>

      <MineCard>
        <form className="ai-box" onSubmit={submitAi}>
          <strong>AI 接口</strong>
          <p>兼容 OpenAI Chat Completions。密钥只存在本机，提问时不会发送密码。</p>
          <label className="sa-label">接口地址<input name="baseUrl" placeholder="https://api.openai.com/v1" defaultValue={aiConfig.baseUrl} /></label>
          <label className="sa-label">模型<input name="model" defaultValue={aiConfig.model} /></label>
          <label className="sa-label">API Key<input name="apiKey" type="password" autoComplete="off" defaultValue={aiConfig.apiKey} /></label>
          <div className="sa-actions">
            <button className="sa-btn sa-btn-primary save" type="submit">保存接口</button>
            <button type="button" className="sa-btn sa-btn-secondary secondary-button" onClick={onTestAi}>测试连接</button>
          </div>
        </form>
      </MineCard>

      {nativeOn ? (
        <MineCard>
          <div className="native-actions sa-actions">
            <button type="button" className="sa-btn sa-btn-secondary" onClick={onOpenAccessibility}>第1步：打开无障碍（自动记账）</button>
            <button type="button" className="sa-btn sa-btn-secondary" onClick={onOpenNotification}>第2步：打开通知使用权</button>
            <button type="button" className="sa-btn sa-btn-secondary" onClick={onOpenAutofill}>第3步：设为自动填充服务</button>
          </div>
        </MineCard>
      ) : null}

      {nativeOn ? (
        <MineCard>
          <section className="payment-capture-diagnostics" aria-label="自动记账诊断">
            <h2>自动记账诊断</h2>
            <p>只在本机保存计数、来源和处理结果；不保存聊天内容、金额或商户。</p>
            <p>诊断状态：{diagnostic.active ? '运行中（最长 10 分钟）' : '已停止'}</p>
            <p>无障碍：{caps.accessibility ? '已开启' : '未开启'} · 通知读取：{caps.notificationListener ? '已开启' : '未开启'} · 应用通知：{caps.notifications ? '已开启' : '未开启'}</p>
            <div className="payment-capture-diagnostic-counts">
              <p>服务启动：{diagnostic.serviceStarts}</p>
              <p>微信界面事件：{diagnostic.accessibilityEvents}</p>
              <p>扫描次数：{diagnostic.scans}</p>
              <p>扫描中读到文字：{diagnostic.nonEmptyScans}</p>
              <p>规则命中：{diagnostic.matches}</p>
              <p>已解析草稿：{diagnostic.parsed}</p>
              <p>重复拦截：{diagnostic.duplicates}</p>
              <p>通知已提交：{diagnostic.notificationsSubmitted}</p>
            </div>
            <p>最近结果：{PAYMENT_CAPTURE_OUTCOME_LABELS[diagnostic.lastOutcome]} · {PAYMENT_CAPTURE_SOURCE_LABELS[diagnostic.lastPackage]} · 事件 {diagnostic.lastEventType} · 文字长度 {diagnostic.lastTextLength}</p>
            <div className="sa-actions">
              <button type="button" className="sa-btn sa-btn-secondary" onClick={onResetPaymentDiagnostics}>清零并开始 10 分钟检测</button>
              <button type="button" className="sa-btn sa-btn-secondary" onClick={onStopPaymentDiagnostics} disabled={!diagnostic.active}>停止诊断</button>
            </div>
            <small>开始后关闭再开启无障碍服务，再回微信重新打开原有转账卡片，最后返回此页查看。计数只在本机保留，10 分钟后自动停止。</small>
          </section>
        </MineCard>
      ) : null}

      <HowToNative />

      <MineCard>
        <section className="profile-actions sa-actions">
          <button type="button" className="sa-btn sa-btn-secondary" onClick={onToggleTheme}>{theme === 'dark' ? '切换浅色模式' : '切换深色模式'}</button>
          <button type="button" className="sa-btn sa-btn-secondary" onClick={onExport}>导出全部数据</button>
          {nativeOn
            ? <button type="button" className="sa-btn sa-btn-secondary" onClick={onNativeImport}>从备份恢复</button>
            : <label className="file-action">从备份恢复<input hidden type="file" accept="application/json,.json" onChange={onImport} /></label>}
          <button type="button" className="sa-btn sa-btn-secondary" onClick={onLoadDemo}>加载演示数据</button>
          <button type="button" className="sa-btn sa-btn-danger danger-text" onClick={onClear}>清空本机数据</button>
        </section>
      </MineCard>

      <p className="sa-page-footer privacy-note">Android 通知记账需系统授权；确认前不会改余额。密码只进入 Keystore，不会发给 AI。</p>
    </div>
  );
}
