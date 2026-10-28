export type MotivationCategory =
  | "firstRecord"
  | "onTrack"
  | "proteinGap"
  | "overTarget"
  | "streak"
  | "weightTrend"
  | "noPlan";

export interface MotivationContext {
  hasRecordsToday: boolean;
  recordCount: number;
  streakDays: number;
  calorieTarget: number;
  caloriesConsumed: number;
  proteinTarget: number;
  proteinConsumed: number;
  weightDeltaKg: number | null;
}
