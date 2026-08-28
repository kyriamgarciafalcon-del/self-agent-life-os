# 自动记账与密码收录

正规路径只有两条。都不静默改数据。

## 支付自动记账

1. 用户在系统设置打开「通知使用权」给 self-agent。
2. `PayNotificationService` 只处理微信 / 支付宝 / 云闪付。
3. `PayParser` 抽出金额、方向、商户。微信通知经常没有金额，金额可为 `null`。
4. 通过 `window.onAutoTxn(json)` 交给网页，或 Compose 确认卡。
5. 用户点「确认入账」后才写 `transactions` 并改账户余额。

不要：Xposed、读微信数据库、无障碍刮聊天、通知一到就扣款。

## 密码自动收录

1. 用户把系统「自动填充服务」选成 self-agent。
2. `SelfAgentAutofillService.onSaveRequest` 只在系统弹出「保存」且用户同意后执行。
3. 账号密码写入独立 `VaultStore`（Android Keystore），不进财务库。
4. 网页侧管家 / 导出拿不到明文。

不要：无障碍遍历输入框、后台键盘记录。

## 网页桥

```js
window.onAutoTxn = function (p) { /* enqueue pending, open confirm */ }
```

实现见 `src/lib/native-bridge.ts` 与记录页待确认队列。
