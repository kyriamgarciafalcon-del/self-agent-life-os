# 旧版资产盘点

盘点日期：2026-09-05
证据起点：`3ff89d86cd53d0801d88a4c6fdeeecbf961b086a`（1.1.86）
本文件不含密钥、PKCS12、真实健康 ZIP 或用户账本。

## 包与签名

| 项 | 证据 |
|---|---|
| applicationId / namespace | `android/app/build.gradle.kts`：`app.selfagent` |
| minSdk / compileSdk | 26 / 35 |
| 签名 | CI 从 GitHub Secrets 重建 PKCS12；`keystore.properties` 不入库 |
| 稳定证书 SHA-256 | `64341f1104e0f421e08ae36c428f3f8f0cae84b98164bbaf59da7edb1386b69f` |
| 工作流触发 | `.github/workflows/android-apk.yml` 仅 `main`、`server-http-webview` |
| 版本 | CI `-PversionCode=100+GITHUB_RUN_NUMBER`，`1.1.${RUN_NUMBER}` |
| 本机构建 | 无本地 JDK/Gradle；APK 必须 CI |

含义：V2 内测 `app.selfagent.v2` 不能假设覆盖安装旧包；Keystore 私有数据通常不能跨 applicationId 搬迁。`v2-native-phase-0` 推送不会自动打旧 APK。

## 数据

| 项 | 证据 |
|---|---|
| Web 主存储 | `self-agent:local-data:v1`（localStorage） |
| schema | v4；失败回退 `self-agent:schema-v3-backup` |
| 结构 | 单 JSON：accounts、transactions、recurringRules、schedules、healthRecords、travels、investments、exchangeRates、memories、vaultItems、inboxItems、auditLog、privacy |
| 发生时间 | `occurredAt`，缺则用 `createdAt` 并标估计 |
| 演示数据 | `demoMode`；迁入默认拒绝，直至决策日志单列关闭 |
| 附件 | 无独立附件表；备份主要是 JSON |

迁移风险：交易 ID 可能重复；余额字段与流水可能不一致；垫付可能被旧报表算进消费；投资可能缺成本/份额；密码项即使出现在 JSON 也不得当明文迁入。

## 可复核复用的原生适配器

路径均在 `android/app/src/main/java/app/selfagent/`。

| 适配器 | 文件 | V2 用法 |
|---|---|---|
| 支付通知解析 | `ledger/PayParser.kt` 等 | 捕获 → 收件箱，不直接入账 |
| 支付无障碍 | `ledger/PayAccessibilityService.kt` | 同上；内测默认关 |
| Gadgetbridge ZIP/DB | `health/GadgetbridgeImportActivity.kt` | 导入命令；保留 SAF 授权模型 |
| 小米睡眠 v6 | `health/XiaomiSleepV6Parser.kt` | 解析器复用 |
| Health Connect | `health/HealthImportActivity.kt` | V2.1 |
| 健康排障 | `health/HealthImportDiagnostics.kt` | 脱敏导出 |
| 提醒闹钟 | `reminders/ReminderScheduler.kt`、`ReminderFireActivity.kt` | 精确提醒能力复核 |
| 旅行解析 | `travel/TravelParser.kt` | 候选草稿 |
| 行情 | `quotes/QuoteSync.kt` | 估值 only，不入账 |
| OCR/语音 | `capture/CaptureController.kt` | 写入待确认文本 |
| AI 协议/BYOK | `ai/AiChatProtocol.kt`、`EncryptedAiConfig.kt` | 独立安全验收 |
| 密码库/Autofill | `vault/*` | 不随业务迁移自动完成 |

禁止：把 React `page.tsx` 状态机搬进 Compose；把 CSS 叠层当设计系统。

## 测试资产（反例/素材）

- `static-web/finance-*.test.ts`、`money.test.ts`：口径对照，不是 Kotlin 规格
- Android：`XiaomiSleepV6ParserTest`、`HealthImportDiagnosticsTest`、`LedgerEventIdentityTest`、`AiByokPolicyTest`、`ReminderSchedulerTest`、`QuoteSyncTest`

新系统按不变量重建测试。

## 迁移七步（阶段 1–2 执行，此处只冻结）

1. 旧数据快照 + SHA-256，不覆盖旧库
2. 校验版本/类型/金额/币种/日期/ID；未知未来版本停止
3. 迁移批次 + 旧记录位置作稳定来源键
4. 临时库导入并输出失败/歧义清单
5. 按币种对账余额、净资产、往来、流水数量、报表差异
6. 用户确认后原子启用新库
7. 旧数据只读；新增量不回灌旧格式

## 不能自动修

重复交易 ID、余额与流水不符、缺发生日期、币种不匹配、旧报销口径、投资缺成本份额、部分历史无法重建（可切换日开账）。

## 官方资料范围

Compose、Room、WorkManager、BLE/Companion Device、ESP-IDF NimBLE、Apple 可访问性方向。具体 token 与四栏是本项目方案，不冒充官方强制规范。
