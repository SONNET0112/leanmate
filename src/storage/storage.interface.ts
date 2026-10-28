import { defaultTemplates, type MealTemplate } from "../modules/plan/templates";
import type { NutritionGoal, UserProfile } from "../modules/plan/plan.types";
import type { FoodRecord } from "../modules/records/records.types";
import type { DailyTask } from "../modules/tasks/tasks.types";
import type { WeightRecord } from "../modules/tracking/tracking.types";

/** v2：新增 mealTemplates（自定义模板），v1 数据在 migrate 中补默认模板。 */
export const SCHEMA_VERSION = 2;

export interface AppData {
  schemaVersion: number;
  profile: UserProfile | null;
  nutritionGoals: NutritionGoal[];
  foodRecords: FoodRecord[];
  weightRecords: WeightRecord[];
  dailyTasks: DailyTask[];
  mealTemplates: MealTemplate[];
}

export interface StorageAdapter {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  clear(): Promise<void>;
}

export const emptyAppData = (): AppData => ({
  schemaVersion: SCHEMA_VERSION,
  profile: null,
  nutritionGoals: [],
  foodRecords: [],
  weightRecords: [],
  dailyTasks: [],
  // 新装用户直接带上默认模板；用户删空后不会被复活，因为空数组是显式值
  mealTemplates: defaultTemplates,
});
