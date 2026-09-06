export function HowToNative() {
  return (
    <>
      <section className="mine-howto howto">
        <h3>怎么自动记账</h3>
        <ol>
          <li>打开手机 <b>设置 → 无障碍 / 已安装的应用</b></li>
          <li>打开 <b>Self Agent</b>（和钱迹一样，用来读支付成功页）</li>
          <li>再用搜索打开 <b>通知使用权</b>，也打开 Self Agent</li>
          <li>微信或支付宝付款成功后，会直接弹出通知</li>
          <li>点通知里的 <b>确认入账</b> 即可，点忽略则不记账</li>
        </ol>
      </section>
      <section className="mine-howto howto">
        <h3>怎么自动记住密码</h3>
        <ol>
          <li>打开手机 <b>设置</b></li>
          <li>搜索“<b>自动填充</b>”</li>
          <li>自动填充服务选 <b>Self Agent</b></li>
          <li>去别的 App 登录，弹出“保存密码？”时点保存</li>
          <li>下次登录选 Self Agent 填充。密码不会进网页和 AI</li>
          <li>Chrome 还要：设置 → 自动填充服务 → 使用其他服务，然后重启 Chrome</li>
          <li>在登录页输入账号密码后点登录，系统应弹出「保存密码？」</li>
        </ol>
      </section>
      <section className="mine-howto howto">
        <h3>12306 和航班</h3>
        <ol>
          <li>打开通知使用权给 Self Agent</li>
          <li>12306 / 航司短信来了会自动识别</li>
          <li>也可以在行程页粘贴短信</li>
        </ol>
      </section>
    </>
  );
}
