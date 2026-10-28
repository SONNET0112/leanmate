import type { FoodState, NutritionTotals } from "../nutrition/nutrition.types";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "早餐",
  lunch: "午餐",
  dinner: "晚餐",
  snack: "加餐",
};

export interface FoodRecord {
  id: string;
  date: string;
  mealType: MealType;
  foodId: string;
  foodNameSnapshot: string;
  amountG: number;
  foodState: FoodState;
  nutritionSnapshot: NutritionTotals;
  createdAt: string;
  updatedAt: string;
}
