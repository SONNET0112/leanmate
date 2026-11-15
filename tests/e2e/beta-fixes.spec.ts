import { expect, test, type Page } from "@playwright/test";

// 内测前修复的回归用例：手机端登录入口 + AI 配置加载竞态
async function onboard(page: Page) {
  await page.goto("/");
  await page.getByLabel("年龄").fill("28");
  await page.getByLabel("身高（cm）").fill("165");
  await page.getByLabel("当前体重（kg）").fill("65");
  await page.getByLabel("目标体重（kg）").fill("58");
  await page.getByLabel("每周运动时长（小时）").fill("3");
  await page.getByRole("button", { name: "生成目标并开始" }).click();
  await expect(page.getByText("今日剩余")).toBeVisible();
}

test("手机端首页能直接看到登录/注册入口", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await onboard(page);
  const login = page.getByRole("button", { name: /登录 \/ 注册/ });
  // 没配 Supabase 的构建没有账号入口，这条用例失去对象
  test.skip((await login.count()) === 0, "当前构建未配置 Supabase，没有登录入口");
  await expect(login).toBeVisible();
  // 侧栏在手机端是隐藏的，这里必须来自新增的页首入口
  await expect(page.locator("div.lg\\:hidden").filter({ has: login })).toBeVisible();
  // 入口能真的点开弹窗
  await login.click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "登录后云端同步" })).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("桌面端首页不会多出一个移动端账号卡片", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await onboard(page);
  const login = page.getByRole("button", { name: /登录 \/ 注册/ });
  test.skip((await login.count()) === 0, "当前构建未配置 Supabase，没有登录入口");
  // 桌面上账号入口只在侧栏，移动端那条是 lg:hidden
  await expect(login).toHaveCount(1);
  await expect(login).toBeVisible();
});

test("AI 配置还在读取时识别按钮不可点，也不会弹出空配置窗", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // 把云端/本机配置探测拖慢，复现「登录后立刻点识别」的时序
  await page.route("**/api/ai/health", async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.fulfill({ status: 404, body: "" });
  });
  await onboard(page);

  const aiButton = page.getByRole("button", { name: "AI 识别" });
  await expect(aiButton).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // 探测结束后（这里是 404 = 未配置）才允许点，并且此时才弹配置窗
  await expect(aiButton).toBeEnabled({ timeout: 15000 });
  await page.getByLabel("AI 一句话描述").fill("中午一碗米饭");
  await aiButton.click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "配置 AI 识别" })).toBeVisible();
});
