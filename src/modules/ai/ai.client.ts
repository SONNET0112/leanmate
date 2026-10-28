import { calculateFoodNutrition } from "../nutrition/nutrition.calculator";
import { findFood } from "../nutrition/nutrition.service";
import type { NutritionTotals } from "../nutrition/nutrition.types";
import type { MealType } from "../records/records.types";
import type { AiError, AiItemSource, AiParseResponse, DraftFoodItem } from "./ai.types";

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const clamp = (v: number, min: number, max: number, fallback: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** 客户端再校验一次服务端数据：AI 输出不可信，越界值一律裁剪。 */
export function toDraftItems(response: unknown): DraftFoodItem[] {
  const payload = response as AiParseResponse;
  if (!payload || !Array.isArray(payload.items)) return [];
  return payload.items.slice(0, 10).flatMap((item, index) => {
    if (!item || typeof item.name !== "string" || !item.name.trim()) return [];
    const food = item.foodId ? findFood(item.foodId) : undefined;
    const per100g: NutritionTotals = food
      ? food.nutritionPer100g
      : {
          caloriesKcal: clamp(Number(item.per100g?.caloriesKcal), 0, 900, 0),
          proteinG: clamp(Number(item.per100g?.proteinG), 0, 100, 0),
          carbohydratesG: clamp(Number(item.per100g?.carbohydratesG), 0, 100, 0),
          fatG: clamp(Number(item.per100g?.fatG), 0, 100, 0),
        };
    const amountG = Math.round(clamp(Number(item.amountG), 1, 2000, 100) * 10) / 10;
    const source: AiItemSource = food ? "database" : "model-estimate";
    return [
      {
        key: `ai-${index}-${item.name}`,
        name: food ? food.name : item.name.trim().slice(0, 40),
        foodId: food ? food.id : null,
        amountG,
        mealType: MEALS.includes(item.mealType) ? item.mealType : "lunch",
        foodState: food ? food.state : "ready_to_eat",
        per100g,
        nutrition: food ? calculateFoodNutrition(food, amountG) : scale(per100g, amountG),
        source,
        confidence: clamp(Number(item.confidence), 0, 1, 0.5),
        basis: String(item.basis ?? "").slice(0, 60),
      },
    ];
  });
}

export function scale(per100g: NutritionTotals, amountG: number): NutritionTotals {
  const f = amountG / 100;
  return {
    caloriesKcal: Math.round(per100g.caloriesKcal * f * 10) / 10,
    proteinG: Math.round(per100g.proteinG * f * 10) / 10,
    carbohydratesG: Math.round(per100g.carbohydratesG * f * 10) / 10,
    fatG: Math.round(per100g.fatG * f * 10) / 10,
  };
}

export async function parseMealWithAi(text: string, signal?: AbortSignal): Promise<DraftFoodItem[]> {
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.BASE_URL}api/ai/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw { code: "TIMEOUT", message: "请求已取消或超时" } as AiError;
    throw { code: "NETWORK", message: "无法连接本地 AI 代理，请确认开发服务器正在运行" } as AiError;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const code = body?.error?.code;
    throw {
      code: code === "NOT_CONFIGURED" || code === "TIMEOUT" || code === "EMPTY" || code === "BAD_TEXT" ? code : "UPSTREAM",
      message: body?.error?.message || `AI 服务不可用（${response.status}）`,
    } as AiError;
  }

  const items = toDraftItems(await response.json());
  if (!items.length) throw { code: "EMPTY", message: "没有识别出食物，请换个说法" } as AiError;
  return items;
}

export async function aiHealth(): Promise<{ configured: boolean; model?: string }> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}api/ai/health`);
    if (!res.ok) return { configured: false };
    return (await res.json()) as { configured: boolean; model?: string };
  } catch {
    return { configured: false };
  }
}
