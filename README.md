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

`android/` 是一个可直接构建的 Android WebView 壳，启动后打开当前 Self Agent 网站，
并保留通知记账与 Autofill 服务入口。原生服务需要用户在 Android 系统设置中主动授权。

### 用 GitHub Actions 打包 APK

推送到 `main` 后，工作流会自动构建 Debug APK。也可以在 GitHub 的 **Actions → Build Android APK → Run workflow** 手动触发，
并按需填写托管网页地址。构建完成后，在工作流页面的 **Artifacts** 下载 `self-agent-debug-apk`，解压得到 `app-debug.apk` 后即可安装。

本地构建（需要 JDK 17、Android SDK 和 Gradle 8.9）：

```bash
gradle --no-daemon -p android assembleDebug
```

默认网页地址是 `https://self-agent-life-os.kyriamgarcialcon.chatgpt.site/!，也可通迃
-PwebAppUrl=https://你的地址/` 覆盖。

更多通知监听说明见 [docs/android-capture.md](docs/android-capture.md)。
