import { expect, test, type Page } from "@playwright/test";

const AI_RESPONSE = {
  model: "test-model",
  items: [
    {
      name: "米饭（熟）",
      foodId: "rice-cooked",
      amountG: 200,
      mealType: "lunch",
      confidence: 0.9,
      basis: "一碗约200g",
      per100g: { caloriesKcal: 116, proteinG: 2.6, carbohydratesG: 25.9, fatG: 0.3 },
    },
    {
      name: "红烧肉",
      foodId: null,
      amountG: 150,
      mealType: "lunch",
      confidence: 0.6,
      basis: "一份约150g",
      per100g: { caloriesKcal: 460, proteinG: 8.5, carbohydratesG: 4.5, fatG: 46 },
    },
    {
      name: "炒青菜",
      foodId: null,
      amountG: 150,
      mealType: "lunch",
      confidence: 0.6,
      basis: "一份约150g",
      per100g: { caloriesKcal: 50, proteinG: 1.8, carbohydratesG: 2.5, fatG: 3.5 },
    },
  ],
};

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

async function addRiceViaSearch(page: Page, amount: string) {
  await page.getByRole("link", { name: /饮食/ }).click();
  await page.getByLabel("搜索食物").fill("米饭");
  await page.getByRole("button", { name: /米饭（熟）/ }).first().click();
  await page.getByRole("button", { name: "午餐", exact: true }).click();
  await page.getByLabel("食物克数").fill(amount);
  await page.getByRole("button", { name: /添加到午餐/ }).click();
}

test("历史日期可以补录，且不会写到今天", async ({ page }) => {
  await onboard(page);
  await page.getByRole("link", { name: /饮食/ }).click();
  await page.getByRole("button", { name: "前一天" }).click();
  await expect(page.getByText("这一天还没有饮食记录")).toBeVisible();

  // 直接在当前页添加，避免点主导航把日期重置回今天
  await page.getByLabel("搜索食物").fill("米饭");
  await page.getByRole("button", { name: /米饭（熟）/ }).first().click();
  await page.getByRole("button", { name: "午餐", exact: true }).click();
  await page.getByLabel("食物克数").fill("150");
  await page.getByRole("button", { name: /添加到午餐/ }).click();
  await expect(page.getByText("1 项 · 174 kcal")).toBeVisible();

  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("leanmate.data")!).foodRecords);
  const dates = new Set(records.map((r: { date: string }) => r.date));
  expect(dates.size).toBe(1);
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  expect(dates.has(iso)).toBe(false);
});

test("AI 识别结果可编辑，且必须确认后才写入记录", async ({ page }) => {
  await page.route("**/api/ai/parse", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(AI_RESPONSE) }),
  );
  await onboard(page);
  await page.getByRole("link", { name: /饮食/ }).click();
  await page.getByLabel("饮食描述").fill("中午吃了一碗米饭、一份红烧肉和一份炒青菜");
  await page.getByRole("button", { name: /AI 识别/ }).click();

  await expect(page.getByText("AI 识别出 3 项")).toBeVisible();
  const names = page.locator('input[aria-label$="食物名称"]');
  await expect(names).toHaveCount(3);
  await expect(names.nth(1)).toHaveValue("红烧肉");
  await expect(page.getByText(/误差可达 ±30%/)).toBeVisible();

  // 未确认前不得写入任何记录
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("leanmate.data")!).foodRecords.length);
  expect(saved).toBe(0);

  // 改重量 → 营养重算（116 * 2.5 = 290）
  await page.getByLabel("米饭（熟） 克数").fill("250");
  await expect(page.getByText(/290 kcal/)).toBeVisible();

  await page.getByRole("button", { name: /确认并保存 3 项/ }).click();
  await expect(page.getByText("已保存到当天记录。")).toBeVisible();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("leanmate.data")!).foodRecords.length);
  expect(saved).toBe(3);
  const total = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("leanmate.data")!).foodRecords.reduce(
      (sum: number, r: { nutritionSnapshot: { caloriesKcal: number } }) => sum + r.nutritionSnapshot.caloriesKcal,
      0,
    ),
  );
  expect(Math.round(total)).toBe(290 + 690 + 75);
});

test("AI 不可用时给出配置提示，离线匹配与手动录入仍可用", async ({ page }) => {
  await page.route("**/api/ai/parse", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "NOT_CONFIGURED", message: "未配置 AI 密钥：请设置环境变量 AI_API_KEY" } }),
    }),
  );
  await onboard(page);
  await page.getByRole("link", { name: /饮食/ }).click();
  await page.getByLabel("饮食描述").fill("中午吃了一碗米饭");
  await page.getByRole("button", { name: /AI 识别/ }).click();
  await expect(page.getByText(/未配置 AI 密钥/)).toBeVisible();

  await page.getByRole("button", { name: "改用离线匹配" }).click();
  await expect(page.getByText(/本地食物库匹配到 1 项/)).toBeVisible();
  await page.getByRole("button", { name: /确认并保存 1 项/ }).click();
  await expect(page.getByText("1 项 · 232 kcal")).toBeVisible();

  // 普通手动记录同样可用
  await addRiceViaSearch(page, "100");
  await expect(page.getByText("2 项 · 348 kcal")).toBeVisible();
});

test("模板可以真正写入指定日期与餐次", async ({ page }) => {
  await onboard(page);
  await page.getByRole("link", { name: /计划/ }).click();
  await page.getByRole("button", { name: /新建模板/ }).click();
  await page.getByRole("button", { name: "编辑" }).last().click();

  await page.getByLabel("模板名称").fill("测试午餐");
  await page.getByLabel("添加食物", { exact: true }).selectOption("rice-cooked");
  await page.getByLabel("添加食物克数").fill("150");
  await page.getByRole("button", { name: /加入/ }).click();
  await page.getByRole("button", { name: /保存模板/ }).click();

  await page.getByLabel("测试午餐 目标餐次").selectOption("dinner");
  await page.getByRole("button", { name: /写入记录/ }).last().click();
  await expect(page.getByText(/已把「测试午餐」的 1 项写入/)).toBeVisible();

  const records = await page.evaluate(() => JSON.parse(localStorage.getItem("leanmate.data")!).foodRecords);
  expect(records).toHaveLength(1);
  expect(records[0].mealType).toBe("dinner");
  expect(records[0].amountG).toBe(150);
});

test("体重可补录与编辑，且不会自动生成新目标", async ({ page }) => {
  await onboard(page);
  const goalsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("leanmate.data")!).nutritionGoals.length);
  await page.getByRole("link", { name: /我的/ }).click();

  await page.getByLabel("体重日期").fill("2026-01-02");
  await page.getByLabel("今日体重").fill("64.2");
  await page.getByRole("button", { name: "记录", exact: true }).click();
  await expect(page.getByText(/2026-01-02 的体重已记录/)).toBeVisible();

  await page.getByLabel("今日体重").fill("64.8");
  await page.getByRole("button", { name: "更新记录" }).click();
  await expect(page.getByText(/已更新 2026-01-02 的体重记录/)).toBeVisible();

  const data = await page.evaluate(() => JSON.parse(localStorage.getItem("leanmate.data")!));
  expect(data.weightRecords).toHaveLength(1);
  expect(data.weightRecords[0].weightKg).toBe(64.8);
  expect(data.nutritionGoals.length).toBe(goalsBefore);
});

test.describe("响应式：五个视口 × 四个主页面无横向溢出", () => {
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 320, height: 700 },
  ];
  for (const viewport of viewports) {
    test(`${viewport.width}×${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await onboard(page);
      for (const path of ["/", "/diet", "/plan", "/profile"]) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${path} 在 ${viewport.width}px 横向溢出`).toBeLessThanOrEqual(0);
      }
    });
  }
});
