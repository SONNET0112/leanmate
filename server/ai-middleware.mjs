import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const foods = JSON.parse(fs.readFileSync(path.join(here, "..", "src", "data", "foods.json"), "utf8"));

const DEFAULTS = {
  baseUrl: "https://api.tokenriver.cn/v1",
  model: "deepseek-flash",
};

export function aiConfig() {
  const apiKey = process.env.AI_API_KEY || process.env.TOKENRIVER_API_KEY || "";
  return {
    apiKey,
    baseUrl: (process.env.AI_BASE_URL || DEFAULTS.baseUrl).replace(/\/$/, ""),
    model: process.env.AI_MODEL || DEFAULTS.model,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 45000),
  };
}

const foodTable = foods
  .map((f) => `${f.id}|${f.name}|${f.state}|${f.nutritionPer100g.caloriesKcal}/${f.nutritionPer100g.proteinG}/${f.nutritionPer100g.carbohydratesG}/${f.nutritionPer100g.fatG}`)
  .join("\n");

const SYSTEM_PROMPT = `你是饮食记录解析器。把用户的一句中文饮食描述拆成食物条目。
只能输出一个 JSON 对象，不要 Markdown、不要解释。格式：
{"items":[{"name":"食物名","foodId":"食物库id或null","amountG":200,"mealType":"breakfast|lunch|dinner|snack","confidence":0.8,"basis":"份量依据，20字内","per100g":{"caloriesKcal":116,"proteinG":2.6,"carbohydratesG":25.9,"fatG":0.3}}]}
规则：
1. 食物库命中时填 foodId（只用下面列表里的 id），并照抄该行每100g数值。
2. 食物库没有命中时 foodId 填 null，per100g 按同类食物公开数据估算。
3. amountG 是克数，1-2000。单位换算：一碗米饭/面约200g，一份炒菜约150g，一个鸡蛋约50g，一杯牛奶约250ml，一两=50g。
4. 用户没写餐次时按描述推断（早/中/晚/加餐），无法推断用 lunch。
5. confidence 0-1，份量越模糊越低；basis 写清估算依据。
6. 最多 10 条，不含重复食物。
食物库（id|名称|状态|每100g 热量/蛋白/碳水/脂肪）：
${foodTable}`;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function readBody(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("请求内容过大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const num = (v, min, max, fallback = 0) => {
  const n = typeof v === "number" ? v : Number.parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const MEALS = new Set(["breakfast", "lunch", "dinner", "snack"]);

/** 服务端只做结构校验与裁剪，不替模型编造数值。 */
export function sanitizeItems(raw) {
  if (!Array.isArray(raw)) return [];
  const ids = new Set(foods.map((f) => f.id));
  const seen = new Set();
  const out = [];
  for (const item of raw.slice(0, 10)) {
    if (!item || typeof item !== "object") continue;
    const name = String(item.name ?? "").trim().slice(0, 40);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const per100g = item.per100g ?? {};
    out.push({
      name,
      foodId: ids.has(item.foodId) ? item.foodId : null,
      amountG: Math.round(num(item.amountG, 1, 2000, 100) * 10) / 10,
      mealType: MEALS.has(item.mealType) ? item.mealType : "lunch",
      confidence: Math.round(num(item.confidence, 0, 1, 0.5) * 100) / 100,
      basis: String(item.basis ?? "").slice(0, 60),
      per100g: {
        caloriesKcal: Math.round(num(per100g.caloriesKcal, 0, 900)),
        proteinG: Math.round(num(per100g.proteinG, 0, 100) * 10) / 10,
        carbohydratesG: Math.round(num(per100g.carbohydratesG, 0, 100) * 10) / 10,
        fatG: Math.round(num(per100g.fatG, 0, 100) * 10) / 10,
      },
    });
  }
  return out;
}

function extractJson(text) {
  const cleaned = String(text ?? "").replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("模型没有返回 JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function handleParse(req, res) {
  if (req.method !== "POST") return sendJson(res, 405, { error: { code: "METHOD", message: "只支持 POST" } });
  const config = aiConfig();
  if (!config.apiKey) {
    return sendJson(res, 503, {
      error: {
        code: "NOT_CONFIGURED",
        message: "未配置 AI 密钥：请设置环境变量 AI_API_KEY（或 TOKENRIVER_API_KEY）后重启开发服务器。",
      },
    });
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req) || "{}");
  } catch {
    return sendJson(res, 400, { error: { code: "BAD_BODY", message: "请求体必须是 JSON" } });
  }
  const text = String(payload.text ?? "").trim();
  if (text.length < 2 || text.length > 500) {
    return sendJson(res, 400, { error: { code: "BAD_TEXT", message: "请描述 2–500 字的饮食内容" } });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const upstream = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return sendJson(res, 502, {
        error: { code: "UPSTREAM", message: `AI 服务返回 ${upstream.status}`, detail: detail.slice(0, 300) },
      });
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    const items = sanitizeItems(extractJson(content).items);
    if (!items.length) {
      return sendJson(res, 502, { error: { code: "EMPTY", message: "没有识别出食物，请换个说法或手动录入" } });
    }
    return sendJson(res, 200, { items, model: data?.model ?? config.model });
  } catch (error) {
    const aborted = error?.name === "AbortError";
    return sendJson(res, aborted ? 504 : 502, {
      error: {
        code: aborted ? "TIMEOUT" : "UPSTREAM",
        message: aborted ? "AI 响应超时，可以重试或手动录入" : "AI 调用失败，可以重试或手动录入",
        detail: String(error?.message ?? "").slice(0, 200),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

export function createAiMiddleware() {
  return function aiMiddleware(req, res, next) {
    const url = (req.url || "").split("?")[0];
    if (url === "/api/ai/health") {
      const config = aiConfig();
      return sendJson(res, 200, { configured: Boolean(config.apiKey), model: config.model, baseUrl: config.baseUrl });
    }
    if (url === "/api/ai/parse") {
      handleParse(req, res).catch((error) => sendJson(res, 500, { error: { code: "INTERNAL", message: error.message } }));
      return;
    }
    next();
  };
}
