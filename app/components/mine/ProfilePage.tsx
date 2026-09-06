import type { ChangeEvent, FormEvent } from 'react';
import { HowToNative } from './HowToNative';
import { MineCard, MineHeader, SettingsGroup, SettingsRow } from './primitives';

export type MineTab = 'life' | 'audit' | 'memory' | 'privacy' | 'vault' | 'data';

export function ProfilePage({
  theme,
  nativeOn,
  aiConfig,
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
  onLoadDemo,
  onClear,
}: {
  theme: 'light' | 'dark';
  nativeOn: boolean;
  aiConfig: { baseUrl: string; model: string; apiKey: string };
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

  return (
    <div className="page profile-page">
      <MineHeader title="我的" subtitle="设置与扩展" />

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

      <HowToNative />

      <MineCard>
        <section className="profile-actions sa-actions">
          <button type="button" className="sa-btn sa-btn-secondary" onClick={onToggleTheme}>{theme === 'dark' ? '切换浅色模式' : '切换深色模式'}</button>
          <button type="button" className="sa-btn sa-btn-secondary" onClick={onExport}>导出全部数据</button>
          <label className="file-action">从备份恢复<input hidden type="file" accept="application/json,.json" onChange={onImport} /></label>
          <button type="button" className="sa-btn sa-btn-secondary" onClick={onLoadDemo}>加载演示数据</button>
          <button type="button" className="sa-btn sa-btn-danger danger-text" onClick={onClear}>清空本机数据</button>
        </section>
      </MineCard>

      <p className="sa-page-footer privacy-note">Android 通知记账需系统授权；确认前不会改余额。密码只进入 Keystore，不会发给 AI。</p>
    </div>
  );
}
