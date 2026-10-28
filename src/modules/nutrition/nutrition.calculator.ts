import type { Food, NutritionTotals } from "./nutrition.types";

/** 内部计算保留 1 位小数，展示层只做取整，避免同一份数据在多个页面算出不同结果。 */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function emptyTotals(): NutritionTotals {
  return { caloriesKcal: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 };
}

export function calculateFoodNutrition(food: Food, amountG: number): NutritionTotals {
  if (!Number.isFinite(amountG) || amountG < 0) {
    throw new Error("食物重量必须是不小于 0 的数字");
  }
  if (amountG > 10000) {
    throw new Error("单次记录不能超过 10000 克");
  }
  const factor = amountG / 100;
  const n = food.nutritionPer100g;
  return {
    caloriesKcal: round1(n.caloriesKcal * factor),
    proteinG: round1(n.proteinG * factor),
    carbohydratesG: round1(n.carbohydratesG * factor),
    fatG: round1(n.fatG * factor),
  };
}

export function sumNutrition(items: NutritionTotals[]): NutritionTotals {
  const total = items.reduce<NutritionTotals>((acc, item) => {
    acc.caloriesKcal += item.caloriesKcal;
    acc.proteinG += item.proteinG;
    acc.carbohydratesG += item.carbohydratesG;
    acc.fatG += item.fatG;
    return acc;
  }, emptyTotals());
  return {
    caloriesKcal: round1(total.caloriesKcal),
    proteinG: round1(total.proteinG),
    carbohydratesG: round1(total.carbohydratesG),
    fatG: round1(total.fatG),
  };
}

/** 按重量比例缩放已有快照，用于编辑记录时重算，且不依赖食物库当前数值。 */
export function scaleSnapshot(snapshot: NutritionTotals, fromAmountG: number, toAmountG: number): NutritionTotals {
  const factor = fromAmountG > 0 ? toAmountG / fromAmountG : 0;
  return {
    caloriesKcal: round1(snapshot.caloriesKcal * factor),
    proteinG: round1(snapshot.proteinG * factor),
    carbohydratesG: round1(snapshot.carbohydratesG * factor),
    fatG: round1(snapshot.fatG * factor),
  };
}

/** 宏量营养素折算热量与标注热量的一致性检查（4/4/9 系数）。 */
export function macroCalories(n: NutritionTotals): number {
  return round1(n.proteinG * 4 + n.carbohydratesG * 4 + n.fatG * 9);
}
