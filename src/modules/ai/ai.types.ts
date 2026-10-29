import type { FoodState, NutritionTotals } from "../nutrition/nutrition.types";
import type { MealType } from "../records/records.types";

export type AiItemSource = "database" | "model-estimate" | "local-match";

/** AI / 本地解析出来的一条食物，只有用户确认后才会变成正式记录。 */
export interface DraftFoodItem {
  key: string;
  name: string;
  foodId: string | null;
  amountG: number;
  mealType: MealType;
  foodState: FoodState;
  per100g: NutritionTotals;
  nutrition: NutritionTotals;
  source: AiItemSource;
  confidence: number;
  basis: string;
}

export interface AiParseResponse {
  items: {
    name: string;
    foodId: string | null;
    amountG: number;
    mealType: MealType;
    confidence: number;
    basis: string;
    per100g: NutritionTotals;
  }[];
  model: string;
}

export interface AiError {
  code: "NOT_CONFIGURED" | "TIMEOUT" | "UPSTREAM" | "NETWORK" | "EMPTY" | "BAD_TEXT" | "UNAUTHORIZED" | "QUOTA" | "UNKNOWN";
  message: string;
}
