import rulesJson from "../../data/diet-rules.json";
import type { ActivityBand, DietRules, NutritionGoal, UserProfile } from "./plan.types";

export const dietRules = rulesJson as unknown as DietRules;

export const PROFILE_LIMITS = {
  age: [14, 90] as const,
  heightCm: [120, 230] as const,
  weightKg: [30, 300] as const,
  weeklyExerciseHours: [0, 40] as const,
};

export function bandForHours(hours: number, bands: ActivityBand[] = dietRules.activityBands): ActivityBand {
  const sorted = [...bands].sort((a, b) => a.maxWeeklyExerciseHours - b.maxWeeklyExerciseHours);
  return sorted.find((band) => hours <= band.maxWeeklyExerciseHours) ?? sorted[sorted.length - 1];
}

export function basalMetabolicRate(profile: Pick<UserProfile, "sex" | "age" | "heightCm" | "currentWeightKg">): number {
  const base = 10 * profile.currentWeightKg + 6.25 * profile.heightCm - 5 * profile.age;
  const offset = profile.sex === "male" ? 5 : profile.sex === "female" ? -161 : -78;
  return base + offset;
}

export interface GoalComputation {
  goal: NutritionGoal;
  bmr: number;
  tdee: number;
  band: ActivityBand;
  deficitAppliedKcal: number;
  floorApplied: boolean;
  estimated: true;
}

export function computeNutritionGoal(profile: UserProfile, fromDate: string, rules: DietRules = dietRules): GoalComputation {
  if (profile.currentWeightKg <= 0) throw new Error("当前体重必须大于 0");
  const bmr = basalMetabolicRate(profile);
  const band = bandForHours(profile.weeklyExerciseHours, rules.activityBands);
  const tdee = bmr * band.factor;
  const rawTarget = tdee - rules.deficitKcal;
  const floor = rules.calorieFloor[profile.sex];
  const calories = Math.round(Math.max(rawTarget, floor));

  const protein = Math.round(rules.proteinGPerKg * profile.currentWeightKg);
  const fat = Math.round(
    Math.max(rules.fatGPerKg * profile.currentWeightKg, (calories * rules.fatMinPercentOfCalories) / 100 / 9),
  );
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return {
    goal: {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `goal-${Date.now()}`,
      effectiveFrom: fromDate,
      basisWeightKg: profile.currentWeightKg,
      dailyCaloriesKcal: calories,
      proteinG: protein,
      carbohydratesG: carbs,
      fatG: fat,
      calculationRuleVersion: rules.version,
      createdAt: new Date().toISOString(),
    },
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    band,
    deficitAppliedKcal: Math.round(Math.min(rules.deficitKcal, Math.max(0, tdee - floor))),
    floorApplied: rawTarget < floor,
    estimated: true,
  };
}

/** 取生效日期不晚于 date 的最新一版目标；同一天多次重算时以 created 时间靠后的为准。 */
export function activeGoal(goals: NutritionGoal[], date: string): NutritionGoal | null {
  if (!goals.length) return null;
  const indexed = goals.map((goal, index) => ({ goal, index }));
  const eligible = indexed.filter(({ goal }) => goal.effectiveFrom <= date);
  const sorted = (eligible.length ? eligible : indexed).sort(
    (a, b) =>
      a.goal.effectiveFrom.localeCompare(b.goal.effectiveFrom) ||
      (a.goal.createdAt ?? "").localeCompare(b.goal.createdAt ?? "") ||
      a.index - b.index,
  );
  // 查询日期早于所有版本时退回最早一版，而不是 null
  return eligible.length ? sorted[sorted.length - 1].goal : sorted[0].goal;
}

export function validateProfileInput(input: {
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  weeklyExerciseHours: number;
}): string | null {
  const checks: [number, readonly [number, number], string][] = [
    [input.age, PROFILE_LIMITS.age, "年龄"],
    [input.heightCm, PROFILE_LIMITS.heightCm, "身高"],
    [input.currentWeightKg, PROFILE_LIMITS.weightKg, "当前体重"],
    [input.targetWeightKg, PROFILE_LIMITS.weightKg, "目标体重"],
    [input.weeklyExerciseHours, PROFILE_LIMITS.weeklyExerciseHours, "每周运动时长"],
  ];
  for (const [value, [min, max], label] of checks) {
    if (!Number.isFinite(value)) return `${label}必须是数字`;
    if (value < min || value > max) return `${label}需在 ${min}–${max} 之间`;
  }
  return null;
}
