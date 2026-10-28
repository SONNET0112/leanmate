export type FoodState = "raw" | "cooked" | "ready_to_eat";

export const FOOD_STATE_LABEL: Record<FoodState, string> = {
  raw: "生重",
  cooked: "熟重",
  ready_to_eat: "即食",
};

export interface NutritionTotals {
  caloriesKcal: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
}

export interface Food {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  state: FoodState;
  nutritionPer100g: NutritionTotals;
  source: string;
  sourceType: "verified" | "estimated";
}
