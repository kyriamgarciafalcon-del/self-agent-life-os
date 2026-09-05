# 旧版资产、签名与迁移盘点

性质：阶段 0 **只读盘点**。证据来自仓库当前树（起点提交 `3ff89d86cd53d0801d88a4c6fdeeecbf961b086a`，审查基线另见 `PRODUCT_BASELINE.md` 的 `6371782208b5de84f9508da5494ac621b511ae0a`）。本文件不包含口令、PKCS12、API Key、密码明文或恢复材料。

V2 不把下列实现逐行翻译成 Kotlin 业务核；财务规则与测试作**反例与素材**。可复用的是已验证的原生解析适配器，且须复核输入、权限、幂等与失败行为。

---

## 1. 旧应用身份与安装策略

| 项 | 证据 | 值 |
|---|---|---|
| 显示名 | `android/app/src/main/res/values/strings.xml` | Self Agent |
| `namespace` / `applicationId` | `android/app/build.gradle.kts` | `app.selfagent` |
| minSdk / targetSdk / compileSdk | 同上 | 26 / 35 / 35 |
| 本地默认 versionName / versionCode | 同上 `orElse` | `1.1.0` / `100` |
| CI version | `.github/workflows/android-apk.yml` | `versionName=1.1.${GITHUB_RUN_NUMBER}`，`versionCode=100+GITHUB_RUN_NUMBER` |
| 启动 Activity | `AndroidManifest.xml` | `app.selfagent.MainActivity` |
| 离线 URL | `MainActivity.kt` `LOCAL_APP_URL` | `https://appassets.androidplatform.net/assets/www/index.html` |
| Web 业务入口 | `README.md`、`app/page.tsx` | SPA；`static-web` 打进 APK |
| 隔离旧前端 | `_quarantine/README.md` | 原 `src/` 无入口，禁止当运行路径 |

V2 内测拟用独立 applicationId `app.selfagent.v2`（见 `v2-native/README.md`），与旧版并行安装。默认关闭新应用自动捕获，避免双开重复识别支付。正式原地升级前必须核对其后的 applicationId、证书与 versionCode；**不能**假设任意 Debug APK 可覆盖旧安装。

`android:allowBackup="false"`：系统自动备份不是业务恢复路径。

---

## 2. 签名与发布工作流（无密钥）

| 项 | 证据 | 说明 |
|---|---|---|
| 签名配置名 | `android/app/build.gradle.kts` `signingConfigs.create("update")` | storeType 默认 PKCS12；debug/release 在材料存在时都用 `update` |
| 材料路径（运行时生成，不入库） | 工作流 + `.gitignore` | `android/keystore/self-agent-update.p12`、`android/keystore/keystore.properties` |
| 忽略规则 | `.gitignore` | `*.p12` `*.jks` `*.keystore` `keystore.properties` |
| 目录说明 | `android/keystore/README.txt` | 稳定更新密钥；更换则所有手机需卸载 |
| 工作流 | `.github/workflows/android-apk.yml` | 触发：`push` 到 `main` 或 `server-http-webview`，或 `workflow_dispatch`。当前文档分支 `v2-native-phase-0` **不在**自动构建列表 |
| 密钥来源 | 同工作流 `secrets.*` 名称 | `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`。仅名称；值不得写入本仓库或本文件 |
| 构建步骤 | 同工作流 | `static-web`：`npm ci` → `npm test` → `npm run build` → 复制到 `android/app/src/main/assets/www/`；然后 `:app:testDebugUnitTest`；`assembleDebug`；`verify-update-cert.py`；上传 `self-agent-debug-apk`；`always()` 删除 p12 与 properties |
| 证书指纹（公开身份，非私钥） | `android/scripts/verify-update-cert.py` `EXPECTED` | SHA-256 `64341f1104e0f421e08ae36c428f3f8f0cae84b98164bbaf59da7edb1386b69f` |
| 本地无材料 | `hasSigningMaterial` | 无 properties 时不配置 signingConfig，产出的 APK 不是稳定更新谱系 |

风险：默认 GHA `debug.keystore` 每次新证书，无法覆盖安装。轮换 PKCS12 会强制全量卸载。旧 Keystore 别名（vault `self_agent_vault_aes`、AI `self_agent_ai_aes`）绑定 `app.selfagent`，**不能**随新 applicationId 自动搬走。

---

## 3. 运行时形状（旧版）

```
static-web/main.tsx → app/page.tsx
  → app/product-logic.ts
  → app/finance-core.ts / finance-query.ts / finance-schema.ts / money.ts
  → dist → CI 复制 assets/www → WebViewAssetLoader
原生桥 SelfAgentNative（MainActivity.AndroidBridge）
```

业务真相在 **WebView localStorage**，不是 Room。账户 `balance` 字段与 posting 重算并存，是迁移时必须对账的双源。`app/money.ts` 已有 minor 字符串，但页面交易金额仍大量使用 `number`（见 `app/page.tsx` `Transaction`），V2 不得把 Double 路径当成已完成的 Money 模型。

`docs/android-capture.md` 仍提到 `window.onAutoTxn` 与已隔离的 `src/lib/native-bridge.ts`；现行代码同时派发 `self-agent:auto-txn` CustomEvent。迁移适配器时只认一种交付，避免双监听双入账。

---

## 4. localStorage schema v4

### 4.1 键

| 键 | 文件 | 内容 |
|---|---|---|
| `self-agent:local-data:v1` | `app/page.tsx` `STORAGE_KEY` | 主业务 JSON；`schemaVersion: 4` |
| `self-agent:schema-v3-backup` | `app/finance-schema.ts` `SCHEMA_V3_BACKUP_KEY` | 升 v4 前快照：`fromVersion`、`toVersion: 4`、`checksum`（FNV-1a 32 位 hex）、`payload` |
| `self-agent:ai-config:v1` | `app/product-logic.ts` `AI_CONFIG_STORAGE_KEY` | **遗留**。hydrate 时 `migrateLegacyAiLocalStorage` 删除；Android 交给 Keystore，浏览器仅 sessionStorage |

校验和算法是 32 位 FNV-1a，不是 SHA-256。V2 迁移快照应改用 SHA-256（基线 §10.2），旧 checksum 只用于识别旧备份是否被改写，不能当完整性终态。

### 4.2 `AppData` 根字段（`app/page.tsx`）

`schemaVersion: 3 \| 4`，`demoMode`，`schedules[]`，`accounts[]`，`transactions[]`，`recurringRules[]`，`healthRecords[]`，`travels[]`，`investments[]`，`exchangeRates[]`，`memories[]`，`privacy`，`vaultItems[]`（仅元数据：id/title/usernameHint/note），`inboxItems[]`，`lastConfirmedInboxId`，`auditLog[]`，`theme`，`permissionOnboarding`。

演示检测：`detectLegacyDemoData` 看日程 `id==='s1'` 且账户 `id==='wechat'`。空数据模板 `emptyData.schemaVersion = 4`。hydrate 失败且 `applySchemaV4Migration.persist===false` 时 `schemaFrozen=true`，停止把新对象写回，以免覆盖可恢复快照。

### 4.3 v3 → v4 交易补丁（`app/finance-schema.ts`）

- 已有 `occurredAt`：补 `status` 默认为 `confirmed`。
- 无 `occurredAt`：用 `createdAt` 填 `occurredAt`，`occurredAtEstimated=true`。
- `verifySchemaV4`：版本必须为 4，每笔交易必须有 `occurredAt`。
- 失败则尝试 restore 备份；仍失败则冻结。

这不是复式账迁移。V2 导入必须重新生成 Journal/Posting，不能把 v4 JSON 当作已平衡凭证。

### 4.4 账户与交易（旧口径）

`ACCOUNT_TYPES`（`finance-core.ts`）：资金账户、储蓄卡、现金、信用卡、理财账户、储值账户、待收回、欠款、物品资产。存在把「待收回」当账户类型的历史；基线规定报销是 Claim，不是账户。

`Transaction.kind`：`expense | income | transfer | adjustment | settlement`。字段含 `amount`/`accountAmount`（number）、`postings[]`、`idempotencyKey`、`status: draft|confirmed|reversed|superseded`、`reversesId`/`reversedBy`、`reimbursable`/`reimbursed`/`reimbursementForId`。草稿与已入账曾共用结构，靠 status 过滤——V2 禁止再这样建模。

周期规则 `recurringRules.lastRunPeriod`：删除已确认账单流水后必须清该字段（`releaseRecurringConfirmation`），否则「本月已确认」泄漏。

### 4.5 收件箱（`product-logic.ts`）

`InboxItem`：`id`，`source` ∈ payment/travel/ocr/voice/manual/ai，`confidence`，`proposedAction`，`payload`，`preview`，`createdAt`，`status` ∈ pending/confirmed/ignored，`dedupeKey`，可选 `sourceEventId`/`resultEntityId`。

`sanitizeInboxPayload` 丢弃匹配 password/apikey/私钥/验证码等键或值。`dedupeKey` **不能**当成稳定跨版本身份；支付应以原生 `sourceEventId` 为准。备份校验 `isBackupPayload` 只要求 schedules/accounts/transactions 为数组，对密钥字段的拒绝不完整——V2 导出必须显式排除秘密并改用版本清单。

### 4.6 健康 / 行程 / 投资 / 隐私

- 健康 `kind`：sleep/meal/exercise/steps/height/weight/heartRate/stress/pai；可选 `externalKey`。睡眠内部是小数小时。
- 行程：train/flight，`verified`，缺字段仍可能被旧解析器写成占位时间——导入时标估计。
- 投资：fund/stock/crypto/meme；`quoteStatus: sample|manual|live`。核心版不迁入自动交易；缺成本/份额不反推收益。
- `privacy`：health/finance/schedule/memory 四开关。
- `vaultItems` 网页侧无密码；真体在 Keystore。JSON 备份出现 `vaultItems` 不得解释为密码库已迁移。

---

## 5. 原生适配器目录（拟复用，须复核）

封装为 V2 `integration/*` 适配器，**禁止**直接写已入账表。输出一律进收件箱或专用导入命令。

| 适配器 | 路径 | 职责 | 复用注意 |
|---|---|---|---|
| 支付解析 | `ledger/PayParser.kt` | 微信/支付宝/云闪付文本 → `PendingTxn`（金额可为 null） | 包名白名单与 Manifest `queries` 一致；`sourceEventId` 优先于 UUID |
| 通知监听 | `ledger/PayNotificationService.kt` | NotificationListener | 只三家支付；密码页跳过 |
| 无障碍 | `ledger/PayAccessibilityService.kt` | 辅助观察，不点击 | 与通知必须合成一条候选 |
| 确认总线 | `ledger/ConfirmBus.kt` `LedgerNotifier.kt` | 确认入账/忽略 heads-up | 未校验金额/账户不得直存 |
| 去重守卫 | `ledger/TxnGuard.kt` prefs `self_agent_txn_guard` | 进程内/本地去重 | 不能合并两笔真实消费 |
| 旅行解析 | `travel/TravelParser.kt` `TravelBus.kt` | 车次/航班正则 | 缺字段保持待确认；懒惰站名截断问题见解析器 |
| Gadgetbridge | `health/GadgetbridgeImportActivity.kt` | SAF 目录/文件、TRIGGER_EXPORT / ZIP_EXPORT | 解析与触发导出分相；ZIP 内 v6 sleep |
| 小米睡眠 v6 | `health/XiaomiSleepV6Parser.kt` | `*_v6.bin` | 有单测；DB 空不代表无睡眠 |
| Health Connect | `health/HealthImportActivity.kt` `HealthBus.kt` | 身高体重心率等 | connect-client `1.1.0-alpha07`（compileSdk 35） |
| 健康诊断导出 | `health/HealthImportDiagnostics.kt` | 白名单 JSON | schemaVersion 1；禁止塞原始秘密 |
| 语音/OCR | `capture/CaptureController.kt` | SpeechRecognizer + ML Kit 中文 OCR | 事件 `self-agent:capture-text`；OCR so 体积大 |
| 提醒 | `reminders/ReminderScheduler.kt` `ReminderFireActivity.kt` | lead + due 双闹钟 | `setAlarmClock`；消息 extras 可能丢失 |
| 行情 | `quotes/QuoteSync.kt` `QuoteBus.kt` | 默认 18:00；Frankfurter/Stooq | 只改估值，不记账；WorkManager 化时不能承诺准点 |
| 能力真值 | `CapabilityStatus.kt` | 无障碍/通知监听/Autofill/通知开关 | `nativeReady()` 只表示 JS 接口存在 |
| 密码库 | `vault/EncryptedVault.kt` 等 | AES-GCM 别名 `self_agent_vault_aes` | **独立验收**；不随业务 JSON 迁移 |
| AI 密钥 | `ai/EncryptedAiConfig.kt` `AiChatClient.kt` `AiChatProtocol.kt` | 别名 `self_agent_ai_aes`；原生 HTTPS | 新包名需用户重配；密钥永不进备份 |
| 桥 | `MainActivity.AndroidBridge` | 权限跳转、import*、syncReminders、askAi… | V2 无 WebView 后改为应用服务调用 |

单测（历史基线，不是 V2 门禁）：`LedgerEventIdentityTest`、`XiaomiSleepV6ParserTest`、`HealthImportDiagnosticsTest`、`QuoteSyncTest`、`ReminderSchedulerTest`、`VaultLookupTest`、`AiByokPolicyTest`、`AiChatProtocolTest`。Web：`static-web` 下 finance/inbox/schema 测试作反例。

---

## 6. 权限与外部包名（Manifest）

权限：INTERNET、POST_NOTIFICATIONS、BOOT、精确闹钟、全屏 Intent、生物识别、录音、相机、Health Connect 读步数/睡眠/运动/心率/身高/体重、忽略电池优化。

`queries` 包名：`com.tencent.mm`、`com.eg.android.AlipayGphone`、`com.unionpay`、小米健康/穿戴、Health Connect、Gadgetbridge 广播 `nodomain.freeyourgadget.gadgetbridge.*`。

V2 并行安装时这些 Listener/Autofill **默认关闭**，由用户选择哪一版捕获。

---

## 7. 迁移风险（不能自动“修好”）

| 风险 | 旧证据 | V2 处理 |
|---|---|---|
| 余额字段 vs posting 重算不一致 | `Account.balance` + `composeTransactionPostings` | 展示两数与差额；禁止静默改历史 |
| 报销当账户 | 类型 `待收回`、`报销账户` 遗留 | 映射为 Claim；无法解释则隔离 |
| 草稿混在 transactions | `status: draft` | 只导入 confirmed/reversed；draft 进 InboxItem |
| 交易 ID 可能重复 | 字符串 id | 迁移来源键 = 批次 + 旧位置，不单信旧 id |
| `occurredAt` 估计 | `occurredAtEstimated` | 保留估计标记，不展示为精确发生 |
| 币种 number/JPY 小数 | `amount: number`，`money.ts` 有 scale 但未贯穿 | 非法金额拒绝；不默认 0 |
| 缺汇率被当 1:1 | 基线明确禁止；旧 UI 可能混加 | 隔离未折算明细 |
| 演示数据 | `demoMode` / s1+wechat | 默认不导入；用户确认才当样本 |
| schema 冻结副本 | `schemaFrozen` + v3 backup | 先恢复用户选择的快照再迁 |
| 校验和过弱 | FNV-1a 8 hex | 新快照 SHA-256；旧 checksum 仅辅助 |
| 备份含可选 `vaultItems` | `isBackupPayload` | 不视为密码库；秘密字段拒绝整包 |
| AI Key 曾在 localStorage | `self-agent:ai-config:v1` | 剥除；新包名重配 |
| 密码库绑定旧 UID | Keystore 别名 + `app.selfagent` | 旧应用继续用，或独立安全迁移，禁止 JSON 冒充 |
| 双应用重复捕获 | 通知+无障碍+两包名 | 内测关 V2 捕获 |
| 投资 meme/crypto/缺份额 | `InvestmentKind` | 核心版只读或待补字段，不造收益 |
| 周期 `lastRunPeriod` 泄漏 | finance-core 已修一截 | 导入时按是否存在对应流水重算 |
| 健康 ZIP vs HC 重复 | `externalKey` 不完全稳定 | sourceRecordId + 冲突列表，不融合 |
| 旅行默认时间 | TravelParser 缺字段 | 待确认，不写 08:00 |
| `android/app/src/main/assets/www/` gitignore | CI 才复制 | 不要把 APK 内 www 当源码真相 |
| 工作流不含本分支 | `android-apk.yml` branches | 阶段 0 不产出 V2 APK |

七步迁移流程以基线 §10.2 为准：快照 → 校验 → 映射 → 临时库 → 对账 → 用户确认 → 旧数据只读。新增量不回灌旧 JSON。

---

## 8. 明确不迁入 V2 运行路径

- React 页面、CSS 叠加、`app/page.tsx` 状态机。
- `_quarantine/old-frontend-src`。
- 网页可写 AI 表单（基线：网页只说明能力）。
- 演示金额与 `demoData` 默认种子。
- 把 `nativeReady()` 当权限真值。
- 云端双向写、自动付款、ESP32（阶段 5 另列）。

---

## 9. 盘点缺口（待用户/实机，不阻塞文档出关）

- 实机已装 APK 的 versionCode 与证书是否等于 `EXPECTED`：本环境未安装用户设备，未声称已核验。
- 用户真实 localStorage 体积与坏账比例：需导出样本后才能估 D-02 工期。
- 密码库条目数：仅能在旧应用内由用户查看，本盘点不得索取明文。

状态：文档完成，待用户确认「可按此做 dry-run 设计」。确认前不写 Room schema。
