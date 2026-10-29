
import { chromium } from "@playwright/test";

const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const APP = process.env.APP_URL || "http://localhost:5187/";
const stamp = Date.now();
const A = { email: `a${stamp}@leanmate.test`, password: "Passw0rd!123" };
const B = { email: `b${stamp}@leanmate.test`, password: "Passw0rd!123" };
console.log(`测试账号（可在 Supabase Auth 里删除）：${A.email} / ${B.email}`);
const results = [];
const check = (name, ok, extra = "") => {
  results.push({ name, ok, extra });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " · " + extra : ""}`);
};

const authFetch = async (email, password) => {
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SB_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${email} -> ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
};
const uidFromToken = (token) => JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8")).sub;

const restGet = async (token, extra = "") => {
  const res = await fetch(`${SB_URL}/rest/v1/leanmate_state?select=id,updated_at${extra}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` },
  });
  return { status: res.status, rows: await res.json().catch(() => null) };
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

async function onboard() {
  await page.goto(APP, { waitUntil: "networkidle" });
  if (await page.getByRole("heading", { name: /先了解一下你的基本情况/ }).count()) {
    await page.getByLabel("年龄").fill("28");
    await page.getByLabel("身高（cm）").fill("165");
    await page.getByLabel("当前体重（kg）").fill("65");
    await page.getByLabel("目标体重（kg）").fill("58");
    await page.getByLabel("每周运动时长（小时）").fill("3");
    await page.getByRole("button", { name: "生成目标并开始" }).click();
    await page.waitForTimeout(700);
  }
}
async function openAuthDialog(register) {
  await page.getByRole("button", { name: /登录 \/ 注册/ }).first().click();
  await page.getByRole("dialog").waitFor();
  if (register) await page.getByRole("button", { name: /还没有账号/ }).click();
}
async function submitAuth(account, register) {
  await page.getByLabel("邮箱").fill(account.email);
  await page.getByLabel("密码").fill(account.password);
  await page.getByRole("button", { name: register ? "注册" : "登录", exact: true }).click();
  await page.waitForTimeout(2500);
}
async function waitSynced() {
  await page.waitForFunction(() => document.body.innerText.includes("已同步到云端"), null, { timeout: 20000 }).catch(() => {});
  return (await page.locator("body").innerText()).includes("已同步到云端");
}

// 1. 注册 A
await onboard();
await openAuthDialog(true);
await submitAuth(A, true);
const authedA = (await page.locator("body").innerText()).includes(A.email);
check("邮箱注册后处于登录态", authedA, await page.locator("body").innerText().then((t) => t.match(/已同步到云端|本机模式|同步失败/)?.[0] ?? ""));

// 2. 首次登录：本机已有资料 → 迁移推送
check("首次登录把本机数据迁移到云端", await waitSynced());
const tokenA = await authFetch(A.email, A.password);

// 3. 新增记录 → 同步
await page.getByRole("link", { name: /饮食/ }).click();
await page.getByLabel("搜索食物").fill("米饭");
await page.getByRole("button", { name: /米饭（熟）/ }).first().click();
await page.getByLabel("食物克数").fill("200");
await page.getByRole("button", { name: /添加到/ }).click();
await page.waitForTimeout(2500);
check("新增记录后再次同步", await waitSynced());

const snapshotA = async () => {
  const res = await fetch(`${SB_URL}/rest/v1/leanmate_state?select=data`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${tokenA}` } });
  const rows = await res.json();
  return rows?.[0]?.data ?? null;
};
const dataA = await snapshotA();
check("云端能读到 A 的快照", Boolean(dataA), `foodRecords=${dataA?.foodRecords?.length ?? "-"} weightRecords=${dataA?.weightRecords?.length ?? "-"}`);

// 4. 刷新后仍在登录 + 数据在
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
check("刷新后会话恢复", (await page.locator("body").innerText()).includes(A.email));
check("刷新后云端数据仍在", (await page.locator("body").innerText()).includes("232"));

// 5. 退出 → 再登录 → 数据恢复
await page.getByRole("button", { name: /退出/ }).first().click();
await page.waitForTimeout(1500);
check("退出后回到未登录", (await page.locator("body").innerText()).includes("登录 / 注册"));
await openAuthDialog(false);
await submitAuth(A, false);
check("重新登录成功", (await page.locator("body").innerText()).includes(A.email));
check("重新登录后数据恢复", await page.waitForFunction(() => document.body.innerText.includes("232"), null, { timeout: 15000 }).then(() => true).catch(() => false));

// 6. 换账号：注册 B 后应回到空白（不能带上 A 的数据）
await page.getByRole("link", { name: /我的/ }).click();
await page.getByRole("button", { name: /退出/ }).first().click();
await page.waitForTimeout(1500);
await openAuthDialog(true);
await submitAuth(B, true);
const onboardingB = await page.getByRole("heading", { name: /先了解一下你的基本情况/ }).count();
check("注册 B 成功并进入空白起点", onboardingB === 1, "换账号后回到引导页 = 不继承上一个账号的数据");
if (onboardingB) {
  await page.getByLabel("年龄").fill("30");
  await page.getByLabel("身高（cm）").fill("170");
  await page.getByLabel("当前体重（kg）").fill("70");
  await page.getByLabel("目标体重（kg）").fill("62");
  await page.getByLabel("每周运动时长（小时）").fill("2");
  await page.getByRole("button", { name: "生成目标并开始" }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /退出/ }).count();
}
const bodyB = await page.locator("body").innerText();
check("B 看不到 A 的饮食记录", !bodyB.includes("232"), "B 的首页没有 A 的 232 kcal");

// 7. RLS：B 直接查库只能看到自己，且写不进 A 的行
const tokenB = await authFetch(B.email, B.password);
const uidA = uidFromToken(tokenA);
const rowsB = await restGet(tokenB);
check("RLS 阻止 B 读到 A 的行", rowsB.status === 200 && !rowsB.rows?.some((r) => r.id === uidA), `B 可见行数=${rowsB.rows?.length}`);
const hijack = await fetch(`${SB_URL}/rest/v1/leanmate_state`, {
  method: "POST",
  headers: { apikey: SB_KEY, Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
  body: JSON.stringify({ id: uidA, data: { schemaVersion: 2, profile: null, nutritionGoals: [], foodRecords: [], weightRecords: [], dailyTasks: [], mealTemplates: [] } }),
});
check("RLS 拒绝把数据写进 A 的行", hijack.status >= 400, `status=${hijack.status}`);

// 8. 回到 A：数据仍是 A 的
await page.getByRole("link", { name: /我的/ }).click();
await page.getByRole("button", { name: /退出/ }).first().click();
await page.waitForTimeout(1500);
await openAuthDialog(false);
await submitAuth(A, false);
await page.waitForTimeout(2500);
await page.getByRole("link", { name: /首页/ }).first().click();
await page.waitForTimeout(800);
const backToA = await page.waitForFunction(() => document.body.innerText.includes("232"), null, { timeout: 15000 }).then(() => true).catch(() => false);
if (!backToA) {
  const dbg = await page.evaluate(async () => {
    const keys = Object.keys(localStorage);
    const raw = localStorage.getItem("leanmate.data");
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      keys,
      foods: parsed?.foodRecords?.length ?? null,
      hasProfile: Boolean(parsed?.profile),
      lastUser: localStorage.getItem("leanmate.lastUser"),
      url: location.href,
      body: document.body.innerText.slice(0, 160).replace(/\n/g, " | "),
    };
  });
  console.log("DEBUG", JSON.stringify(dbg));
}
check("切回 A 后数据仍是 A 的", backToA);

check("无浏览器运行时错误", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
await page.screenshot({ path: "C:/Users/ASUS/AppData/Local/hermes/cache/scratch/cloud-accept.png" });
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
