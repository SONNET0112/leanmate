import { describe, expect, it } from "vitest";
import { activeGoal, bandForHours, computeNutritionGoal, dietRules, validateProfileInput } from "./plan.service";
import type { NutritionGoal, UserProfile } from "./plan.types";

const base: UserProfile = {
  id: "u1",
  sex: "male",
  age: 30,
  heightCm: 175,
  currentWeightKg: 80,
  targetWeightKg: 72,
  weeklyExerciseHours: 3,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

describe("bandForHours", () => {
  it("按运动时长落入对应区间", () => {
    expect(bandForHours(0).factor).toBe(1.2);
    expect(bandForHours(2).factor).toBe(1.375);
    expect(bandForHours(3).factor).toBe(1.55);
    expect(bandForHours(5).factor).toBe(1.55);
    expect(bandForHours(6).factor).toBe(1.725);
  });
});

describe("computeNutritionGoal", () => {
  it("BMR 采用 Mifflin-St Jeor", () => {
    const r = computeNutritionGoal(base, "2026-10-28");
    expect(r.bmr).toBe(1749); // 10*80 + 6.25*175 - 5*30 + 5 = 1748.75
    expect(r.band.factor).toBe(1.55);
    expect(r.goal.dailyCaloriesKcal).toBe(Math.round(1748.75 * 1.55 - dietRules.deficitKcal));
  });

  it("宏量营养素热量与标注热量一致（误差 ≤ 4 kcal）", () => {
    const { goal } = computeNutritionGoal(base, "2026-10-28");
    const macroKcal = goal.proteinG * 4 + goal.carbohydratesG * 4 + goal.fatG * 9;
    expect(Math.abs(macroKcal - goal.dailyCaloriesKcal)).toBeLessThanOrEqual(4);
  });

  it("体重越高蛋白目标越高", () => {
    const lighter = computeNutritionGoal({ ...base, currentWeightKg: 60 }, "2026-10-28");
    expect(lighter.goal.proteinG).toBeLessThan(computeNutritionGoal(base, "2026-10-28").goal.proteinG);
  });

  it("热量不低于下限", () => {
    const small = computeNutritionGoal(
      { ...base, sex: "female", currentWeightKg: 45, heightCm: 150, age: 60, weeklyExerciseHours: 0 },
      "2026-10-28",
    );
    expect(small.goal.dailyCaloriesKcal).toBeGreaterThanOrEqual(dietRules.calorieFloor.female);
    expect(small.floorApplied).toBe(true);
  });

  it("记录计算规则版本与依据体重", () => {
    const { goal } = computeNutritionGoal(base, "2026-10-28");
    expect(goal.calculationRuleVersion).toBe(dietRules.version);
    expect(goal.basisWeightKg).toBe(80);
  });

  it("old 目标带有效日期，便于追溯", () => {
    const { goal } = computeNutritionGoal(base, "2026-10-28");
    expect(goal.effectiveFrom).toBe("2026-10-28");
  });
});

describe("activeGoal", () => {
  const goals: NutritionGoal[] = [
    { id: "a", effectiveFrom: "2026-10-01", basisWeightKg: 80, dailyCaloriesKcal: 2300, proteinG: 128, carbohydratesG: 250, fatG: 70, calculationRuleVersion: "1.0.0", createdAt: "" },
    { id: "b", effectiveFrom: "2026-10-20", basisWeightKg: 78, dailyCaloriesKcal: 2200, proteinG: 125, carbohydratesG: 240, fatG: 68, calculationRuleVersion: "1.0.0", createdAt: "" },
  ];

  it("取不晚于查询日期的最新版本", () => {
    expect(activeGoal(goals, "2026-10-25")?.id).toBe("b");
    expect(activeGoal(goals, "2026-10-10")?.id).toBe("a");
  });

  it("早于全部版本时退回最早一版而不是 null", () => {
    expect(activeGoal(goals, "2026-09-01")?.id).toBe("a");
  });

  it("同一天多次重算取最后生成的一版", () => {
    const sameDay: NutritionGoal[] = [
      { ...goals[0], id: "x", effectiveFrom: "2026-10-28", createdAt: "2026-10-28T01:00:00.000Z", dailyCaloriesKcal: 2300 },
      { ...goals[0], id: "y", effectiveFrom: "2026-10-28", createdAt: "2026-10-28T09:00:00.000Z", dailyCaloriesKcal: 2250 },
    ];
    expect(activeGoal(sameDay, "2026-10-28")?.id).toBe("y");
  });

  it("没有目标时返回 null", () => {
    expect(activeGoal([], "2026-10-25")).toBeNull();
  });
});

describe("validateProfileInput", () => {
  it("拒绝越界数值", () => {
    expect(validateProfileInput({ age: 5, heightCm: 175, currentWeightKg: 80, targetWeightKg: 72, weeklyExerciseHours: 3 })).toContain("年龄");
    expect(validateProfileInput({ age: 30, heightCm: 175, currentWeightKg: 0, targetWeightKg: 72, weeklyExerciseHours: 3 })).toContain("当前体重");
  });

  it("合法输入返回 null", () => {
    expect(validateProfileInput({ age: 30, heightCm: 175, currentWeightKg: 80, targetWeightKg: 72, weeklyExerciseHours: 3 })).toBeNull();
  });
});
