# V2 任务清单

状态：`todo` / `blocked` / `doing` / `done`
阶段 0 未出关前，**F-01 及之后保持 `blocked`**。未决口径见 `DECISIONS.md`；出关条件见 `PHASE0_SCOPE.md`。

未来实现根目录：`v2-native/`（阶段 1 再建少量 Gradle 模块，禁止空模块狂欢）。旧 `android/` 只维护，本清单不授权改它。

Owner 为占位，待人员到位后替换：`@owner-android` `@owner-product` `@owner-qa` `@user`。

RED：先写会失败的测试并记录失败证据。GREEN：最小实现让该测试与既有门禁通过。未提交的 GREEN 不算完成。

---

## 阶段 0 关闭

| ID | 任务 | 依赖 | 未来路径（文档） | 验收 | Owner | 状态 |
|---|---|---|---|---|---|---|
| P-00 | 独立分支与目录边界 | 无 | `v2-native/` `v2-native/README.md` | 不改 `android/` 运行路径；无 Gradle/Compose/Room | `@owner-android` | done |
| P-01 | 冻结范围与决策 | P-00 | `docs/PHASE0_SCOPE.md` `docs/DECISIONS.md` | 已冻结/未决分开；无阻断 F-01 的开口径 | `@owner-product` | done |
| P-02 | 信任区与财务规则 | P-01 | `docs/TRUST_ZONES.md` `docs/FINANCE_RULES.md` | S1–S10 公式无互斥 | `@owner-product` | done |
| P-03 | 四栏线框 | P-01 | `docs/PROTOTYPE_WIREFRAMES.md` | 今天/账本/生活/助手/收件箱/设置；主动作；五态；48dp；200%/读屏；S1–S10 走查 | `@owner-product` | done |
| P-04 | 旧版盘点 | P-00 | `docs/LEGACY_INVENTORY.md` | 包名、签名工作流、schema v4、适配器、迁移风险；无密钥值 | `@owner-android` | done |
| P-05 | 可追溯矩阵与本清单 | P-01 | `docs/TRACEABILITY.md` `docs/BACKLOG.md` | 基线章节均有交付物指针 | `@owner-product` | done |
| P-06 | 用户确认十场景与线框 | P-02 P-03 P-04 | 无代码路径 | 书面确认 S1–S10 与六页线框；仓库仍无密钥文件 | `@user` | blocked |

P-06 是阶段 0 出关锁。未完成不得打开 F-01。

---

## 阶段 1 财务核心（出关后）

| ID | 任务 | 依赖 | 未来路径 | RED | GREEN | 验收 | Owner | 状态 |
|---|---|---|---|---|---|---|---|---|
| F-01 | Money 与币种解析 | P-06 | `v2-native/core/money/Money.kt` `Currency.kt` `v2-native/core/money/MoneyTest.kt` | JPY 带小数、溢出、非法串、经 Double 的解析被测试捕获且失败 | 整数最小单位；列表外币种拒绝；不改写为 0 | 精度、符号、JPY、非法值、溢出 | `@owner-android` | blocked |
| F-02 | 账务表与初始迁移 | F-01 | `v2-native/data/room/AppDatabase.kt` `entities/` `dao/` `Migrations.kt` `AppDatabaseTest.kt` | 无外键仍能插入不平衡/孤儿 posting | 外键、唯一 journalId、空库可备份恢复原型 | 外键、唯一 ID、备份恢复原型 | `@owner-android` | blocked |
| F-03 | PostJournal 命令 | F-02 | `v2-native/domain/ledger/PostJournal.kt` `v2-native/application/CommandService.kt` `PostJournalTest.kt` | 币种不匹配、缺账户、零金额仍入账 | 单事务写 journal+postings+receipt；每币种 Σ=0 | 事务、平衡、账户币种、幂等 commandId | `@owner-android` | blocked |
| F-04 | 冲销与更正 | F-03 | `v2-native/domain/ledger/ReverseJournal.kt` `CorrectJournal.kt` `ReverseJournalTest.kt` | 重复冲销产生第二套凭证；更正中断留下半笔 | 原 ID 保留；反向+新凭证同事务；同命令重放返回既有结果 | 唯一 ID、重复调用、原子替代 | `@owner-android` | blocked |
| F-05 | 往来与结算分配 | F-03 | `v2-native/domain/ledger/Claim.kt` `SettleClaim.kt` `ClaimTest.kt` | 超额收回成功；跨币种被接受 | 部分收回；未结≥0；超额拒绝 | 部分收回、超额拒绝、核销 | `@owner-android` | blocked |
| F-06 | 唯一查询层 | F-03 F-05 | `v2-native/application/query/LedgerQueries.kt` `LedgerQueriesTest.kt` | 页面私自 reduce 与查询结果不一致即可红 | 余额/个人消费/现金流/净资产固定样例一致 | 与报表名称、公式同 `FINANCE_RULES.md` | `@owner-android` | blocked |
| BAK-01 | 加密备份与临时库恢复（基线 D-01） | F-02 | `v2-native/data/backup/EncryptedBackup.kt` `RestoreTest.kt` | 坏文件/错误口令覆盖当前库 | 先写临时库；失败回退；导出不含密钥 | 换机、截断、篡改、失败回退（库未定则功能不开，见 Q-04） | `@owner-android` | blocked |
| BAK-02 | 旧版迁移 dry-run（基线 D-02） | F-04 F-05 F-06 | `v2-native/data/migrate/LegacyImporter.kt` `Mapping.kt` `DryRunReport.kt` `LegacyImporterTest.kt` | 无差异报告仍启用新库；重复旧 ID 被当成同一凭证 | 来源键=批次+位置；歧义隔离；演示数据默认不迁 | 差异报告与歧义清单；不写密钥 | `@owner-android` | blocked |

财务可写发布硬门槛：基线 §12.1 十条，**任一失败停止发布**。阶段 1 出关至少覆盖其中与 F-01–F-06 相关的不变量测试。

---

## 阶段 2 可日用核心版

| ID | 任务 | 依赖 | 未来路径 | RED / GREEN | 验收 | Owner | 状态 |
|---|---|---|---|---|---|---|---|
| U-01 | 设计系统与页面骨架 | P-06 | `v2-native/feature/ui/PageScaffold.kt` `MoneyText.kt` `EmptyState.kt` `Theme.kt` `Navigation.kt` `UiScaffoldTest.kt` | RED：核心按钮 <48dp 或无五态也可提交。GREEN：四栏导航、主题、字号缩放 | 主题、48dp、读屏、200% 不挡主动作 | `@owner-android` | blocked |
| U-02 | 一页记账与账本页 | U-01 F-06 | `v2-native/feature/ledger/LedgerScreen.kt` `RecordExpenseScreen.kt` `LedgerScreenTest.kt` | RED：金额空缺进入预览或双击记两笔。GREEN：真实 PostJournal + 查询刷新 | 仪器测试含保存后重启仍在 | `@owner-android` | blocked |
| L-01 | 今天 / 任务 / 日程基础 | U-01 | `v2-native/feature/today/TodayScreen.kt` `v2-native/feature/life/Task.kt` `CalendarEvent.kt` `TodayScreenTest.kt` | RED：完成任务复制成三条互不关联记录。GREEN：完成实例、不永久完成重复规则 | 完成任务；跨午夜刷新今天 | `@owner-android` | blocked |
| I-01 | 收件箱与命令回执 | F-03 | `v2-native/feature/inbox/InboxScreen.kt` `v2-native/application/InboxService.kt` `InboxTest.kt` | RED：并发确认入两笔；草稿进已入账表。GREEN：版本校验、commandId 幂等 | 确认、忽略、冲突、去重 | `@owner-android` | blocked |
| BAK-03 | 迁移演练 + 备份恢复 UI | BAK-01 BAK-02 U-01 | `v2-native/feature/settings/BackupScreen.kt` `MigrationSummaryScreen.kt` | RED：失败仍切换库。GREEN：失败文案 + 当前库不变 | 用户可见差异；不含密码库冒充 | `@owner-android` | blocked |

阶段 2 出关：手动录入 → 杀进程 → 恢复可见；S1–S10 可在 UI 走通（仪器测试，不只按钮名）。

---

## 阶段 3 AI 与生活接入

| ID | 任务 | 依赖 | 未来路径 | RED / GREEN | 验收 | Owner | 状态 |
|---|---|---|---|---|---|---|---|
| A-01 | AI 查询与草稿工具 | I-01 F-06 | `v2-native/integration/ai/ChatCompletionsAdapter.kt` `ToolDrafts.kt` `AiPrivacy.kt` `AiToolTest.kt` | RED：非法 JSON/虚构账户被当成已执行。GREEN：只读查询 + proposal，确认走命令 | 歧义、权限撤回、无网络、取消后迟到响应 | `@owner-android` | blocked |
| H-01 | 健康手动 + 趋势 | L-01 | `v2-native/feature/life/HealthScreen.kt` `HealthQueries.kt` | RED：缺日补 0 或把昨日写成今天。GREEN：空日、`X小时Y分钟` | 非诊断文案；权限关则助手无健康 | `@owner-android` | blocked |
| H-02 | HC / Gadgetbridge 适配 | H-01 | `v2-native/integration/health/` 复核后包装 `android/.../XiaomiSleepV6Parser.kt` 等 | RED：ZIP 与 HC 重复融合。GREEN：sourceRecordId 冲突列表 | 未复核禁止直接调旧桥（Q-09） | `@owner-android` | blocked |
| C-01 | 通知捕获 | I-01 | `v2-native/integration/capture/` 包装 `PayParser.kt` | RED：双通道记两笔；内测默认开捕获。GREEN：一条 InboxItem；V2 默认关 | 金额缺失走补全，不直存 | `@owner-android` | blocked |
| T-01 | 旅行候选 | I-01 | `v2-native/integration/travel/` 包装 `TravelParser.kt` | RED：缺字段写成 08:00 已确认。GREEN：待确认草稿 | 不登录 12306 | `@owner-android` | blocked |

---

## 阶段 4–5（后置开关）

| ID | 任务 | 依赖 | 未来路径 | 验收 | Owner | 状态 |
|---|---|---|---|---|---|---|
| INV-01 | 投资写入 | F-06 且核心版硬门槛绿 | `v2-native/domain/invest/` | 现金/持仓/成本/估值分开；报价不记账 | `@owner-android` | blocked |
| FX-01 | 换汇 | F-03 Q-01 关闭 | `v2-native/domain/ledger/FxTrade.kt` | 双方金额+汇率；禁 1:1 | `@owner-android` | blocked |
| VLT-01 | 原生密码库接入 | Q-05 验收 | `v2-native/integration/vault/` | JSON 备份不得冒充已迁；旧包名 Keystore 不搬 | `@owner-android` | blocked |
| E-01 | 设备事件模拟器 | I-01 | `v2-native/integration/device/DeviceEventSimulator.kt` `DeviceIdempotencyTest.kt` | 无硬件可测重发、冲突、未执行 | `@owner-android` | blocked |
| E-02 | BLE 终端联调 | E-01 且核心版已过 | `v2-native/integration/device/BleTerminal.kt` | 双设备隔离、掉线重启、解绑 | `@owner-android` | blocked |

---

## 依赖顺序（编码）

```
P-06 用户确认
 └── F-01 Money
      └── F-02 Room
           ├── F-03 PostJournal ── F-04 冲销
           │                    └── F-05 往来 ── F-06 查询
           └── D-01 备份
 D-02 迁移 dry-run ← F-04 + F-05 + F-06 + D-01
 U-01 骨架 ← P-06
 U-02 记账页 ← U-01 + F-06
 I-01 收件箱 ← F-03
 L-01 今天 ← U-01
 A-01 / C-01 / H-* / E-01 ← I-01（及各自域查询）
```

## 阶段 0 提交后立即状态

文档合入后：P-00–P-05 → `done`；P-06 等待 `@user`；其余 `blocked`。任何 PR 必须引用本文件任务 ID 与对应规则/线框章节。
