// Supabase Edge Function：AI 代理 + 用户密钥托管
// 部署：supabase functions deploy ai-proxy --no-verify-jwt=false
// 需要的环境变量（Supabase 会自动注入前两个）：
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// 说明：api_key 只在这里读写，永远不会返回给浏览器。

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const DEFAULTS = { baseUrl: "https://api.deepseek.com", model: "deepseek-flash" };
const TIMEOUT_MS = 45_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "只支持 POST" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: userData, error: userError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  const user = userData?.user;
  if (userError || !user) return json({ error: "未登录或会话已过期" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "请求体必须是 JSON" }, 400);
  }
  const action = String(body.action ?? "parse");

  if (action === "status") {
    const { data } = await admin.from("user_ai_config").select("base_url, model").eq("user_id", user.id).maybeSingle();
    return json({ configured: Boolean(data), baseUrl: data?.base_url ?? null, model: data?.model ?? null });
  }

  if (action === "clear") {
    const { error } = await admin.from("user_ai_config").delete().eq("user_id", user.id);
    if (error) return json({ error: error.message }, 500);
    return json({ configured: false });
  }

  const baseUrl = String(body.baseUrl ?? DEFAULTS.baseUrl).trim().replace(/\/$/, "");
  const model = String(body.model ?? DEFAULTS.model).trim();
  const apiKey = String(body.apiKey ?? "").trim();

  if (action === "save") {
    if (!/^https:\/\//.test(baseUrl) || !model || !apiKey) return json({ error: "接口地址、模型和密钥都要填" }, 400);
    const { error } = await admin
      .from("user_ai_config")
      .upsert({ user_id: user.id, base_url: baseUrl, model, api_key: apiKey, updated_at: new Date().toISOString() });
    if (error) return json({ error: error.message }, 500);
    return json({ configured: true, baseUrl, model });
  }

  // parse / test 都需要密钥：请求里带了就用请求里的（仅在保存前测试时），否则用已存的
  let key = apiKey;
  let useBase = baseUrl;
  let useModel = model;
  if (!key) {
    const { data } = await admin.from("user_ai_config").select("base_url, model, api_key").eq("user_id", user.id).maybeSingle();
    if (!data) return json({ error: "还没有配置 AI 密钥", code: "NOT_CONFIGURED" }, 400);
    key = data.api_key;
    useBase = data.base_url;
    useModel = data.model;
  }

  const text = action === "test" ? "鸡蛋" : String(body.text ?? "").trim();
  if (action === "parse" && (text.length < 2 || text.length > 500)) return json({ error: "请描述 2–500 字的饮食内容" }, 400);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const upstream = await fetch(`${useBase}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: useModel,
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
      const status = upstream.status;
      const mapped =
        status === 401 || status === 403
          ? { code: 401, message: "API Key 无效或没有权限" }
          : status === 402 || status === 429
            ? { code: 429, message: "额度不足或请求过于频繁" }
            : { code: 502, message: `AI 服务返回 ${status}` };
      return json({ error: mapped.message, detail: detail.slice(0, 300) }, mapped.code);
    }

    const data = await upstream.json();
    const content = data?.choices?.[0]?.message?.content ?? "";
    if (action === "test") return json({ ok: true, model: data?.model ?? useModel });

    const cleaned = String(content).replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return json({ error: "模型没有返回 JSON" }, 502);
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return json({ items: Array.isArray(parsed.items) ? parsed.items.slice(0, 10) : [], model: data?.model ?? useModel });
  } catch (error) {
    const aborted = (error as Error)?.name === "AbortError";
    return json({ error: aborted ? "AI 响应超时" : "AI 调用失败" }, aborted ? 504 : 502);
  } finally {
    clearTimeout(timer);
  }
});

const SYSTEM_PROMPT = `你是饮食记录解析器。把用户的一句中文饮食描述拆成食物条目。
只能输出一个 JSON 对象，不要 Markdown、不要解释。格式：
{"items":[{"name":"食物名","foodId":null,"amountG":200,"mealType":"breakfast|lunch|dinner|snack","confidence":0.8,"basis":"份量依据，20字内","per100g":{"caloriesKcal":116,"proteinG":2.6,"carbohydratesG":25.9,"fatG":0.3}}]}
规则：amountG 为克数 1-2000；一碗米饭约 200g、一个鸡蛋约 50g、一杯牛奶约 250ml；餐次无法判断用 lunch；
confidence 0-1，份量越模糊越低；最多 10 条且不重复。`;
