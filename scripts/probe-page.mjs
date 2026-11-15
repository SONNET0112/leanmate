import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://127.0.0.1:8090/";
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 400)));
page.on("requestfailed", (r) => console.log("REQFAIL", r.url().slice(0, 120), r.failure()?.errorText));
await page.goto(url, { waitUntil: "networkidle" }).catch((e) => console.log("GOTO", e.message));
await page.waitForTimeout(3000);
console.log("root children:", await page.evaluate(() => document.getElementById("root")?.children.length));
console.log("body text:", (await page.textContent("body"))?.trim().slice(0, 200));
await browser.close();
