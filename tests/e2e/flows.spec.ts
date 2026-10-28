import { expect, test, type Page } from "@playwright/test";

async function onboard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /先了解一下你的基本情况/ })).toBeVisible();
  await page.getByLabel("年龄").fill("28");
  await page.getByLabel("身高（cm）").fill("165");
  await page.getByLabel("当前体重（kg）").fill("65");
  await page.getByLabel("目标体重（kg）").fill("58");
  await page.getByLabel("每周运动时长（小时）").fill("3");
  await page.getByRole("button", { name: "生成目标并开始" }).click();
  await expect(page.getByText("今日剩余")).toBeVisible();
}

async function addChicken(page: Page, amount = "150") {
  await page.getByRole("link", { name: /饮食/ }).click();
  await page.getByLabel("搜索食物").fill("鸡胸");
  await page.getByRole("button", { name: /鸡胸肉（生）/ }).first().click();
  await page.getByRole("button", { name: "午餐", exact: true }).click();
  await page.getByLabel("食物克数").fill(amount);
  await page.getByRole("button", { name: /添加到午餐/ }).click();
}

test("新用户完成初始化后可以添加饮食记录并在首页看到汇总", async ({ page }) => {
  await onboard(page);
  await addChicken(page, "150");
  await expect(page.getByText("1 项 · 177 kcal")).toBeVisible();

  await page.getByRole("link", { name: /首页/ }).click();
  await expect(page.getByText("今日剩余")).toBeVisible();
  await expect(page.getByText("1 项")).toBeVisible();
  await expect(page.getByRole("link", { name: "去记录" })).toBeVisible();
});

test("修改记录克数后汇总更新，刷新后数据仍然存在", async ({ page }) => {
  await onboard(page);
  await addChicken(page, "150");

  const amount = page.locator('input[aria-label="鸡胸肉（生） 克数"]');
  await amount.fill("200");
  await amount.blur();
  await expect(page.getByText("1 项 · 236 kcal")).toBeVisible();

  await page.reload();
  await page.getByRole("link", { name: /饮食/ }).click();
  await expect(page.getByText("1 项 · 236 kcal")).toBeVisible();

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除 鸡胸肉（生）" }).click();
  await expect(page.getByText("这一天还没有饮食记录")).toBeVisible();
});

test("记录体重的当日规则、导出与导入保护", async ({ page }) => {
  await onboard(page);
  await page.getByRole("link", { name: /我的/ }).click();
  await page.getByLabel("今日体重").fill("64.6");
  await page.getByRole("button", { name: "记录", exact: true }).click();
  await expect(page.getByText(/的体重已记录/)).toBeVisible();
  await expect(page.getByText("今日 64.6 kg")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^leanmate-\d{4}-\d{2}-\d{2}\.json$/);
  const exported = await download.path();
  expect(exported).toBeTruthy();

  page.on("dialog", (dialog) => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles(exported!);
  await expect(page.getByText("导入成功，页面数据已更新。")).toBeVisible();
  await expect(page.getByText(/1 条体重记录/)).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{oops") });
  await expect(page.getByText("文件不是合法的 JSON")).toBeVisible();
  await expect(page.getByText(/1 条体重记录/)).toBeVisible();
});
