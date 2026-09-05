# 阶段 0 可追溯矩阵

## 基线身份

- 原始方案：`PRODUCT_BASELINE.md`
- 原始方案 SHA-256：`36dbcfa318820a9f5e1f74da093fa3885e4782a86ff977c9a3b8fe4ab43f6736`
- V2 阶段 0 起点：`3ff89d86cd53d0801d88a4c6fdeeecbf961b086a`
- 起点旧版：Self Agent 1.1.86，继续由原 `android/` + `static-web/` 路径维护
- 本矩阵不表示 V2 功能已实现，只证明需求已被阶段文档覆盖。

## 需求到交付物

| 原始方案章节 | 阶段 0 交付物 | 证明内容 |
|---|---|---|
| §1 最终决策 | `README.md`、`DECISIONS.md` | 原生单写端、旧版保留、非一次替换 |
| §2 版本边界 | `PHASE0_SCOPE.md`、`BACKLOG.md` | V2/V2.1/V2.2 边界与后置项 |
| §3 产品结构 | `PROTOTYPE_WIREFRAMES.md` | 四栏导航、收件箱、设置、首页减负 |
| §4 界面规范 | `PROTOTYPE_WIREFRAMES.md`、`DECISIONS.md` | token、48dp、200% 字体、读屏和状态 |
| §5 财务域 | `FINANCE_RULES.md` | Money、posting、往来、冲销、投资边界 |
| §6 架构 | `DECISIONS.md`、`BACKLOG.md` | 单应用模块化、命令/查询、依赖方向 |
| §7 AI | `TRUST_ZONES.md`、`PROTOTYPE_WIREFRAMES.md` | 最小上下文、草稿确认、真实能力状态 |
| §8 生活域 | `PROTOTYPE_WIREFRAMES.md`、`BACKLOG.md` | 任务/日程/健康/旅行边界 |
| §9 可靠性 | `TRUST_ZONES.md`、`BACKLOG.md` | 事务、备份、后台状态、诊断清理 |
| §10 迁移 | `LEGACY_INVENTORY.md`、`BACKLOG.md` | dry-run、映射、差异报告、回退 |
| §11 ESP32 | `DECISIONS.md`、`BACKLOG.md` | 后置设备阶段、手机权威、事件幂等 |
| §12 验收 | `PHASE0_SCOPE.md`、`FINANCE_RULES.md` | 财务硬门槛和用户流程门禁 |
| §13 实施 | `BACKLOG.md` | 依赖、验收、状态、未来文件路径 |
| §14 风险 | `DECISIONS.md`、`LEGACY_INVENTORY.md` | 风险、触发条件与重新评估点 |
| §15 完成定义 | `PHASE0_SCOPE.md` | 阶段 0 与全 V2 完成定义分离 |
| §16 依据 | `LEGACY_INVENTORY.md` | 代码证据和官方资料范围 |

## 变更纪律

1. `PRODUCT_BASELINE.md` 原文只允许以新版本文件替代，不直接覆盖；新版本必须记录旧、新 SHA-256 与决策原因。
2. 已冻结规则如需改变，先在 `DECISIONS.md` 新增 supersedes 记录，再改相关验收。
3. 未决项必须保持显式；不得在实现中暗自选择口径。
4. 每个未来 PR 必须引用 `BACKLOG.md` 任务 ID 和对应规则/线框章节。
5. V2 可写代码进入前，阶段 0 出关检查必须全部通过并获得用户确认。
