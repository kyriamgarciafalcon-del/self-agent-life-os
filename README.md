# self-agent

本机优先个人管家：日程 + 多账户财务 + 待确认的支付识别 + 独立密码库。

产品入口是 `app/page.tsx`（逻辑在 `app/product-logic.ts`）。Android WebView 加载打包进 APK 的 `static-web` 离线页面，不依赖远程托管域名。

## 网页前端

底栏：首页 / 日程 / 记录 / 财务 / 我的，以及健康、行程、隐私、记忆、密码库与审计。

本地静态包：

```bash
cd static-web
npm ci
npm test
npm run build
```

旧的 `src/routes/*` 前端已证明无入口引用，已隔离到 `_quarantine/old-frontend-src`。

账户只在财务里。支付识别先确认再入账。密码不进账本、不进对话。记忆默认不发送；需要单独打开记忆摘要权限，并按条允许 `sendAllowed`。

## 安卓

`android/` 是可直接构建的 Android WebView 壳。启动后加载 `android/app/src/main/assets/www` 离线页面，并保留通知记账与 Autofill 服务入口。原生服务需要用户在 Android 系统设置中主动授权。

AI 密钥只存在 Android Keystore。浏览器会话是独立 BYOK：仅 HTTPS 公网主机，禁止 localhost / 内网 / 链路本地地址，拒绝异常跳转。

### 用 GitHub Actions 打包 APK

推送到 `main` 后，工作流会自动构建 Debug APK。也可以在 GitHub 的 **Actions → Build Android APK → Run workflow** 手动触发。构建完成后，在工作流页面的 **Artifacts** 下载 `self-agent-debug-apk`，解压得到 `app-debug.apk` 后即可安装。

本地构建（需要 JDK 17、Android SDK 和 Gradle 8.9）：

```bash
gradle --no-daemon -p android assembleDebug
```

更多通知监听说明见 [docs/android-capture.md](docs/android-capture.md)。
