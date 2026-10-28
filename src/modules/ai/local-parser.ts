import { findFood, foods } from "../nutrition/nutrition.service";
import { FOOD_STATE_LABEL } from "../nutrition/nutrition.types";
import type { MealType } from "../records/records.types";
import { scale } from "./ai.client";
import type { DraftFoodItem } from "./ai.types";

// 离线兜底：只做「食物库名称/别名匹配 + 单位换算」，不猜库里没有的食物
const UNIT_GRAMS: Record<string, number> = {
  克: 1, g: 1, 千克: 1000, kg: 1000, 毫升: 1, ml: 1, 两: 50, 斤: 500,
  碗: 200, 份: 150, 盘: 150, 个: 50, 杯: 250, 片: 25, 勺: 15,
};

const SEPARATORS = /[、,，。;；\n和跟加及与+]/;

function detectMealType(text: string): MealType | null {
  if (/早餐|早上|早晨/.test(text)) return "breakfast";
  if (/中午|午餐|午饭/.test(text)) return "lunch";
  if (/晚上|晚餐|晚饭/.test(text)) return "dinner";
  if (/加餐|夜宵|零食|下午茶/.test(text)) return "snack";
  return null;
}

function parseAmount(segment: string): { amountG: number; matched: string } | null {
  const numeric = segment.match(/(\d+(?:\.\d+)?)\s*(千克|kg|克|g|毫升|ml|两|斤)/i);
  if (numeric) {
    const unit = numeric[2].toLowerCase();
    return { amountG: Number(numeric[1]) * (UNIT_GRAMS[unit] ?? 1), matched: numeric[0] };
  }
  const chinese = segment.match(/(半|一|两|二|三|四|五|六|七|八|九|十)\s*(碗|份|盘|个|杯|片|勺)/);
  if (chinese) {
    const table: Record<string, number> = { 半: 0.5, 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    return { amountG: (table[chinese[1]] ?? 1) * (UNIT_GRAMS[chinese[2]] ?? 100), matched: chinese[0] };
  }
  return null;
}

/** 返回可编辑草稿 + 未匹配片段（提示用户手动补录）。 */
export function parseMealLocally(text: string, fallbackMeal: MealType = "lunch"): {
  items: DraftFoodItem[];
  unmatched: string[];
} {
  const mealFromText = detectMealType(text);
  const segments = text.split(SEPARATORS).map((s) => s.trim()).filter(Boolean);
  const items: DraftFoodItem[] = [];
  const unmatched: string[] = [];

  for (const segment of segments) {
    const food = foods
      .filter((f) => segment.includes(f.name) || f.aliases.some((alias) => alias.length >= 2 && segment.includes(alias)))
      .sort((a, b) => b.name.length - a.name.length)[0];
    if (!food) {
      if (parseAmount(segment) || segment.length >= 2) unmatched.push(segment.replace(/^(我|今天|中午|晚上|早上|吃了|喝了)/, ""));
      continue;
    }
    const amount = parseAmount(segment)?.amountG ?? 100;
    items.push({
      key: `local-${items.length}-${food.id}`,
      name: food.name,
      foodId: food.id,
      amountG: Math.round(amount * 10) / 10,
      mealType: mealFromText ?? fallbackMeal,
      foodState: food.state,
      per100g: food.nutritionPer100g,
      nutrition: scale(food.nutritionPer100g, amount),
      source: "local-match",
      confidence: 0.9,
      basis: `${FOOD_STATE_LABEL[food.state]}，本地食物库匹配；份量按描述换算`,
    });
  }

  return { items, unmatched };
}
