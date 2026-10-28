import { describe, expect, it } from "vitest";
import { addFoodRecord, deleteFoodRecord, getDailySummary, getMealSummary, updateFoodRecord } from "./records.service";
import type { FoodRecord } from "./records.types";

const nutrition = { caloriesKcal: 118, proteinG: 22.5, carbohydratesG: 0, fatG: 2 };

function seed(): FoodRecord[] {
  let records: FoodRecord[] = [];
  records = addFoodRecord(records, {
    date: "2026-10-28",
    mealType: "lunch",
    foodId: "chicken-breast-raw",
    foodName: "鸡胸肉（生）",
    amountG: 100,
    foodState: "raw",
    nutrition,
  });
  return records;
}

describe("records", () => {
  it("新增记录后进入当日汇总", () => {
    const records = seed();
    expect(records).toHaveLength(1);
    expect(getDailySummary(records, "2026-10-28").proteinG).toBe(22.5);
  });

  it("修改重量后汇总按比例更新", () => {
    const records = seed();
    const updated = updateFoodRecord(records, records[0].id, { amountG: 200 });
    expect(getDailySummary(updated, "2026-10-28").proteinG).toBe(45);
  });

  it("修改餐次不改变营养快照", () => {
    const records = seed();
    const updated = updateFoodRecord(records, records[0].id, { mealType: "dinner" });
    expect(getMealSummary(updated, "2026-10-28", "lunch").proteinG).toBe(0);
    expect(getMealSummary(updated, "2026-10-28", "dinner").proteinG).toBe(22.5);
  });

  it("删除记录后汇总同步减少", () => {
    const records = seed();
    const empty = deleteFoodRecord(records, records[0].id);
    expect(getDailySummary(empty, "2026-10-28").caloriesKcal).toBe(0);
  });

  it("非法重量被拒绝", () => {
    const records = seed();
    expect(() => updateFoodRecord(records, records[0].id, { amountG: 0 })).toThrow();
    expect(() => updateFoodRecord(records, records[0].id, { amountG: -5 })).toThrow();
  });

  it("其他日期的记录不计入当天", () => {
    const records = addFoodRecord(seed(), {
      date: "2026-10-27",
      mealType: "dinner",
      foodId: "rice-cooked",
      foodName: "米饭（熟）",
      amountG: 200,
      foodState: "cooked",
      nutrition: { caloriesKcal: 232, proteinG: 5.2, carbohydratesG: 51.8, fatG: 0.6 },
    });
    expect(getDailySummary(records, "2026-10-28").proteinG).toBe(22.5);
    expect(getDailySummary(records, "2026-10-27").proteinG).toBe(5.2);
  });

  it("修改记录不影响其他记录的快照", () => {
    const records = seed();
    const two = addFoodRecord(records, {
      date: "2026-10-28",
      mealType: "lunch",
      foodId: "rice-cooked",
      foodName: "米饭（熟）",
      amountG: 100,
      foodState: "cooked",
      nutrition: { caloriesKcal: 116, proteinG: 2.6, carbohydratesG: 25.9, fatG: 0.3 },
    });
    const updated = updateFoodRecord(two, two[0].id, { amountG: 50 });
    expect(updated[1].nutritionSnapshot.proteinG).toBe(2.6);
  });
});
