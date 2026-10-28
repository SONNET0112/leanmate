export type Sex = "male" | "female" | "other";

export interface UserProfile {
  id: string;
  sex: Sex;
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  weeklyExerciseHours: number;
  exerciseType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionGoal {
  id: string;
  effectiveFrom: string;
  basisWeightKg: number;
  dailyCaloriesKcal: number;
  proteinG: number;
  carbohydratesG: number;
  fatG: number;
  calculationRuleVersion: string;
  createdAt: string;
}

export interface ActivityBand {
  maxWeeklyExerciseHours: number;
  factor: number;
  label: string;
}

export interface DietRules {
  version: string;
  updatedAt: string;
  status: string;
  statusNote: string;
  bmr: { method: string; source: string; formula: Record<Sex, string>; note: string };
  activityBands: ActivityBand[];
  activitySource: string;
  deficitKcal: number;
  deficitNote: string;
  calorieFloor: Record<Sex, number>;
  proteinGPerKg: number;
  proteinSource: string;
  fatGPerKg: number;
  fatMinPercentOfCalories: number;
  videoDerivedCoefficients: { status: string; note: string; values: unknown[] };
}
