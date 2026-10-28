import { describe, expect, it } from "vitest";
import { calculateFoodNutrition, macroCalories, scaleSnapshot, sumNutrition } from "./nutrition.calculator";
import type { Food } from "./nutrition.types";

const chicken: Food = {
  id: "test-chicken",
  name: "鸡胸肉",
  aliases: [],
  category: "蛋白质",
  state: "raw",
  nutritionPer100g: { caloriesKcal: 118, proteinG: 22.5, carbohydratesG: 0, fatG: 2 },
  source: "test",
  sourceType: "estimated",
};

describe("calculateFoodNutrition", () => {
  it("按每 100g 基准线性换算", () => {
    const r = calculateFoodNutrition(chicken, 150);
    expect(r.proteinG).toBeCloseTo(33.75, 1);
    expect(r.caloriesKcal).toBeCloseTo(177, 1);
  });

  it("0 克返回全 0", () => {
    expect(calculateFoodNutrition(chicken, 0)).toEqual({
      caloriesKcal: 0,
      proteinG: 0,
      carbohydratesG: 0,
      fatG: 0,
    });
  });

  it("负数与超限输入被拒绝", () => {
    expect(() => calculateFoodNutrition(chicken, -1)).toThrow();
    expect(() => calculateFoodNutrition(chicken, Number.NaN)).toThrow();
    expect(() => calculateFoodNutrition(chicken, 20000)).toThrow();
  });

  it("小数重量按 1 位小数取整", () => {
    const r = calculateFoodNutrition(chicken, 33.3);
    expect(r.proteinG).toBe(7.5);
    expect(r.caloriesKcal).toBe(39.3);
  });
});

describe("sumNutrition", () => {
  it("汇总多条记录", () => {
    const a = calculateFoodNutrition(chicken, 100);
    const b = calculateFoodNutrition(chicken, 50);
    const total = sumNutrition([a, b]);
    expect(total.proteinG).toBeCloseTo(33.8, 1);
  });

  it("空数组返回 0", () => {
    expect(sumNutrition([])).toEqual({ caloriesKcal: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 });
  });
});

describe("scaleSnapshot", () => {
  it("编辑重量时按原快照比例缩放", () => {
    const snap = calculateFoodNutrition(chicken, 100);
    expect(scaleSnapshot(snap, 100, 200).proteinG).toBeCloseTo(45, 1);
  });

  it("原重量为 0 时不产生 NaN", () => {
    expect(scaleSnapshot({ caloriesKcal: 0, proteinG: 0, carbohydratesG: 0, fatG: 0 }, 0, 100).proteinG).toBe(0);
  });
});

describe("macroCalories", () => {
  it("用 4/4/9 折算", () => {
    expect(macroCalories({ caloriesKcal: 0, proteinG: 10, carbohydratesG: 20, fatG: 5 })).toBe(165);
  });
});
