import { emptyTotals, scaleSnapshot, sumNutrition } from "../nutrition/nutrition.calculator";
import type { NutritionTotals } from "../nutrition/nutrition.types";
import type { FoodRecord, MealType } from "./records.types";
import { MEAL_ORDER } from "./records.types";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export interface NewRecordInput {
  date: string;
  mealType: MealType;
  foodId: string;
  foodName: string;
  amountG: number;
  foodState: FoodRecord["foodState"];
  nutrition: NutritionTotals;
}

export function addFoodRecord(records: FoodRecord[], input: NewRecordInput, now = new Date().toISOString()): FoodRecord[] {
  const record: FoodRecord = {
    id: newId(),
    date: input.date,
    mealType: input.mealType,
    foodId: input.foodId,
    foodNameSnapshot: input.foodName,
    amountG: input.amountG,
    foodState: input.foodState,
    nutritionSnapshot: { ...input.nutrition },
    createdAt: now,
    updatedAt: now,
  };
  return [...records, record];
}

/** 改重量时按原快照比例重算，历史记录不受食物库后续改动影响。 */
export function updateFoodRecord(
  records: FoodRecord[],
  id: string,
  patch: { amountG?: number; mealType?: MealType },
  now = new Date().toISOString(),
): FoodRecord[] {
  return records.map((record) => {
    if (record.id !== id) return record;
    const amountG = patch.amountG ?? record.amountG;
    if (!Number.isFinite(amountG) || amountG <= 0) throw new Error("食物重量必须大于 0");
    return {
      ...record,
      mealType: patch.mealType ?? record.mealType,
      amountG,
      nutritionSnapshot:
        amountG === record.amountG
          ? record.nutritionSnapshot
          : scaleSnapshot(record.nutritionSnapshot, record.amountG, amountG),
      updatedAt: now,
    };
  });
}

export function deleteFoodRecord(records: FoodRecord[], id: string): FoodRecord[] {
  return records.filter((record) => record.id !== id);
}

export function recordsForDate(records: FoodRecord[], date: string): FoodRecord[] {
  return records.filter((record) => record.date === date);
}

export function getDailySummary(records: FoodRecord[], date: string): NutritionTotals {
  const day = recordsForDate(records, date);
  return day.length ? sumNutrition(day.map((r) => r.nutritionSnapshot)) : emptyTotals();
}

export function getMealSummary(records: FoodRecord[], date: string, mealType: MealType): NutritionTotals {
  const meal = recordsForDate(records, date).filter((r) => r.mealType === mealType);
  return meal.length ? sumNutrition(meal.map((r) => r.nutritionSnapshot)) : emptyTotals();
}

export function mealTotals(records: FoodRecord[], date: string): { mealType: MealType; totals: NutritionTotals; count: number }[] {
  return MEAL_ORDER.map((mealType) => {
    const meal = recordsForDate(records, date).filter((r) => r.mealType === mealType);
    return {
      mealType,
      totals: meal.length ? sumNutrition(meal.map((r) => r.nutritionSnapshot)) : emptyTotals(),
      count: meal.length,
    };
  });
}

/** 指定日期默认餐次：历史日期固定午餐，当天按当前小时推断。 */
export function defaultMealFor(date: string, today: string, hour = new Date().getHours()): MealType {
  if (date !== today) return "lunch";
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}
