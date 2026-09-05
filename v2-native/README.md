# Self Agent V2 Native

Self Agent V2 的阶段 0 工作区。目标是建立 Android 原生、本机优先、账本可信、AI 受控、设备可连接的新系统。

## 当前阶段

**Phase 0：冻结规则与原型。** 本目录当前只允许产品、架构、规则、迁移盘点、页面线框和任务拆解；不包含可写业务实现，不接入旧版运行路径，也不修改现有 `android/` WebView 应用。

## 不变量

- 当前正式旧版继续位于 `android/`，包名 `app.selfagent`，可独立维护和回退。
- V2 内测拟使用独立 applicationId：`app.selfagent.v2`，可与旧版并行安装。
- Android 是 V2 唯一正式业务写入端；网页不维护第二套可写业务核心。
- 财务、健康、日程、AI、设备均通过定义明确的命令或查询边界。
- 密码、验证码、私钥、助记词和恢复码永不进入 AI、业务备份、诊断包或设备端。
- 阶段 0 未出关前，不创建 Room schema、Compose 空页面或 Gradle 模块。
- 可点线框原型：[`prototype/index.html`](prototype/index.html)（纸面走查，不能记账）

## 文档索引

- [`docs/PRODUCT_BASELINE.md`](docs/PRODUCT_BASELINE.md)：用户确认的完整目标方案（原文）
- [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md)：章节到交付物映射与变更纪律
- [`docs/PHASE0_SCOPE.md`](docs/PHASE0_SCOPE.md)：阶段范围、交付与出关条件
- [`docs/DECISIONS.md`](docs/DECISIONS.md)：已冻结决策与待决策项
- [`docs/TRUST_ZONES.md`](docs/TRUST_ZONES.md)：数据和 AI 信任边界
- [`docs/FINANCE_RULES.md`](docs/FINANCE_RULES.md)：财务核心不变量与关键场景
- [`docs/PROTOTYPE_WIREFRAMES.md`](docs/PROTOTYPE_WIREFRAMES.md)：四栏导航和核心流程线框
- [`docs/LEGACY_INVENTORY.md`](docs/LEGACY_INVENTORY.md)：旧版资产、迁移与签名盘点
- [`docs/BACKLOG.md`](docs/BACKLOG.md)：依赖有序的可执行任务清单

## 阶段门禁

进入 F-01 前必须满足 `PHASE0_SCOPE.md` 的全部出关条件，并由用户确认页面线框和十个关键业务场景。任何未决财务口径均阻止财务核心编码。
