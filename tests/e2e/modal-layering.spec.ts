import { expect, test, type Page } from "@playwright/test";

// 线上问题：侧栏是 sticky 堆叠上下文，登录弹窗的 z-50 被关在里面，主内容里的 AI 面板会盖住它
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

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

/** 弹窗四角与中心的命中测试：只要有一处落到弹窗外，就说明被别的东西挡住了 */
async function assertOnTop(page: Page, title: string) {
  const bad = await page.evaluate((heading) => {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].find((d) =>
      d.textContent?.includes(heading),
    );
    if (!dialog) return "no-dialog";
    const card = dialog.firstElementChild as HTMLElement;
    const r = card.getBoundingClientRect();
    const points = [
      [r.left + 16, r.top + 16],
      [r.right - 16, r.top + 16],
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + r.width / 2, r.bottom - 16],
      [r.left - 30, r.top + 30], // 遮罩层本身也要盖住背景
    ];
    for (const [x, y] of points) {
      const el = document.elementFromPoint(x, y);
      if (!el || !dialog.contains(el)) {
        return `${Math.round(x)},${Math.round(y)} 被 ${el?.tagName}.${String((el as HTMLElement).className).slice(0, 40)} 盖住`;
      }
    }
    return "ok";
  }, title);
  expect(bad).toBe("ok");
}

test("登录弹窗不会被 AI 面板遮挡，关闭后 AI 面板恢复可交互", async ({ page }) => {
  await onboard(page);
  const loginBtn = page.getByRole("button", { name: /登录 \/ 注册/ });
  // 没配 Supabase 时账号入口不渲染，这条用例失去对象
  test.skip((await loginBtn.count()) === 0, "当前构建未配置 Supabase，没有登录入口");

  await page.getByRole("button", { name: "记早餐" }).click();
  await expect(page.getByLabel("AI 一句话描述")).toHaveValue("早餐：");

  await loginBtn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "登录后云端同步" })).toBeVisible();
  await assertOnTop(page, "登录后云端同步");

  // 背景（AI 面板）此时点不到：遮罩吃掉这次点击
  const chip = page.getByRole("button", { name: "记午餐" });
  const chipBox = await chip.boundingBox();
  expect(chipBox).not.toBeNull();
  await page.mouse.click(chipBox!.x + chipBox!.width / 2, chipBox!.y + chipBox!.height / 2);
  await expect(page.getByLabel("AI 一句话描述")).toHaveValue("早餐：");

  // 模式切换照常，遮罩层级不变
  await dialog.getByRole("button", { name: "还没有账号？注册" }).click();
  await expect(dialog.getByRole("heading", { name: "注册账号" })).toBeVisible();
  await assertOnTop(page, "注册账号");

  await dialog.getByRole("button", { name: "关闭" }).click();
  await expect(dialog).toHaveCount(0);
  await chip.click();
  await expect(page.getByLabel("AI 一句话描述")).toHaveValue("午餐：");
});

test("AI 配置弹窗同样在遮罩之上", async ({ page }) => {
  // 伪装成本机没有 AI 代理，点识别只会弹配置窗，不会真的发请求
  await page.route("**/api/ai/health", (route) => route.fulfill({ status: 404, body: "" }));
  await onboard(page);
  await page.getByLabel("AI 一句话描述").fill("中午一碗米饭");
  await page.getByRole("button", { name: "AI 识别" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "配置 AI 识别" })).toBeVisible();
  await assertOnTop(page, "配置 AI 识别");
  await expect(page.getByLabel("AI 接口地址")).toBeVisible();
  await dialog.getByRole("button", { name: "关闭" }).click();
  await expect(dialog).toHaveCount(0);
});
