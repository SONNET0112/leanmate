import foodsJson from "../../data/foods.json";
import type { Food } from "./nutrition.types";

export const foods: Food[] = foodsJson as Food[];

export function findFood(id: string): Food | undefined {
  return foods.find((f) => f.id === id);
}

export function searchFoods(query: string, limit = 8): Food[] {
  const q = query.trim().toLowerCase();
  if (!q) return foods.slice(0, limit);
  const scored = foods
    .map((food) => {
      const name = food.name.toLowerCase();
      const alias = food.aliases.find((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()));
      if (name === q) return { food, score: 0 };
      if (name.includes(q)) return { food, score: 1 };
      if (alias) return { food, score: 2 };
      if (food.category.toLowerCase().includes(q)) return { food, score: 3 };
      return null;
    })
    .filter((x): x is { food: Food; score: number } => x !== null)
    .sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((x) => x.food);
}


/** 名称/别名精确优先，其次包含匹配；AI 结果改名后用它重新对齐食物库。 */
export function findFoodByName(name: string, state?: Food["state"]): Food | undefined {
  const q = name.trim();
  if (!q) return undefined;
  const candidates = foods.filter((f) => (state ? f.state === state : true));
  return (
    candidates.find((f) => f.name === q) ??
    candidates.find((f) => f.aliases.includes(q)) ??
    candidates.find((f) => f.name.includes(q) || q.includes(f.name))
  );
}
