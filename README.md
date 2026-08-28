# self-agent

本机优先个人管家：日程 + 多账户财务 + 待确认的支付识别 + 独立密码库。

## 网页前端

底栏：首页 / 日程 / 记录 / 财务 / 我的。

- `/` 首页 `src/routes/index.tsx`
- `/calendar` 日程 `src/routes/calendar.tsx`
- `/record` 记录 `src/routes/record.tsx`
- `/finance` 财务 `src/routes/finance.index.tsx`
- `/finance/accounts` 账户 `src/routes/finance.accounts.tsx`
- `/me` 我的 `src/routes/me.tsx`
- `/vault` 密码库 `src/routes/vault.tsx`
- `/add` 添加日程 `src/routes/add.tsx`

账户只在财务里。支付识别先确认再入账。密码不进账本、不进对话。

## 安卓

见 `android/` 与 [docs/android-capture.md](docs/android-capture.md)。
