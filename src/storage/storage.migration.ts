import { defaultTemplates, type MealTemplate } from "../modules/plan/templates";
import { emptyAppData, SCHEMA_VERSION, type AppData } from "./storage.interface";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isNutrition = (v: unknown): boolean =>
  isObj(v) && ["caloriesKcal", "proteinG", "carbohydratesG", "fatG"].every((k) => isNum(v[k]));
const isMeal = (v: unknown) => v === "breakfast" || v === "lunch" || v === "dinner" || v === "snack";
const isFoodState = (v: unknown) => v === "raw" || v === "cooked" || v === "ready_to_eat";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validateTemplates(value: unknown): MealTemplate[] | null {
  if (value === undefined || value === null) return null;
  assert(Array.isArray(value), "mealTemplates 必须是数组");
  value.forEach((t, i) => {
    assert(isObj(t) && isStr(t.id) && isStr(t.name), `mealTemplates[${i}] 缺少 id 或名称`);
    assert(isObj(t) && isMeal(t.mealType), `mealTemplates[${i}] 餐次不合法`);
    assert(isObj(t) && Array.isArray(t.items), `mealTemplates[${i}] items 必须是数组`);
    (t.items as unknown[]).forEach((item, j) => {
      assert(isObj(item) && isStr(item.foodId), `mealTemplates[${i}].items[${j}] 缺少 foodId`);
      assert(isObj(item) && isNum(item.amountG) && item.amountG > 0, `mealTemplates[${i}].items[${j}] 克数不合法`);
    });
  });
  return value as MealTemplate[];
}

export function validateAppData(value: unknown): AppData {
  assert(isObj(value), "文件不是有效的 LeanMate 数据");
  const version = value.schemaVersion;
  assert(isNum(version), "缺少 schemaVersion");
  assert(version <= SCHEMA_VERSION, `数据版本 ${version} 高于当前应用支持的 ${SCHEMA_VERSION}，请先升级应用`);

  const profile = value.profile;
  if (profile !== null && profile !== undefined) {
    assert(isObj(profile), "profile 结构不正确");
    assert(isStr(profile.id), "profile.id 缺失");
    assert(isStr(profile.sex), "profile.sex 缺失");
    assert(isNum(profile.age) && isNum(profile.heightCm), "profile 年龄或身高不正确");
    assert(isNum(profile.currentWeightKg) && isNum(profile.targetWeightKg), "profile 体重字段不正确");
    assert(isNum(profile.weeklyExerciseHours), "profile.weeklyExerciseHours 不正确");
  }

  const goals = value.nutritionGoals ?? [];
  assert(Array.isArray(goals), "nutritionGoals 必须是数组");
  goals.forEach((g, i) => {
    assert(isObj(g) && isStr(g.id) && isStr(g.effectiveFrom), `nutritionGoals[${i}] 缺少 id 或生效日期`);
    assert(isNum(g.dailyCaloriesKcal) && isNum(g.proteinG) && isNum(g.carbohydratesG) && isNum(g.fatG), `nutritionGoals[${i}] 营养数值不正确`);
  });

  const records = value.foodRecords ?? [];
  assert(Array.isArray(records), "foodRecords 必须是数组");
  records.forEach((r, i) => {
    assert(isObj(r) && isStr(r.id) && isStr(r.date), `foodRecords[${i}] 缺少 id 或日期`);
    assert(isMeal(r.mealType), `foodRecords[${i}] 餐次不合法`);
    assert(isFoodState(r.foodState), `foodRecords[${i}] 食物状态不合法`);
    assert(isNum(r.amountG) && r.amountG > 0, `foodRecords[${i}] 重量不合法`);
    assert(isStr(r.foodNameSnapshot), `foodRecords[${i}] 缺少食物名称快照`);
    assert(isNutrition(r.nutritionSnapshot), `foodRecords[${i}] 营养快照不完整`);
  });

  const weights = value.weightRecords ?? [];
  assert(Array.isArray(weights), "weightRecords 必须是数组");
  weights.forEach((w, i) => {
    assert(isObj(w) && isStr(w.id) && isStr(w.date), `weightRecords[${i}] 缺少 id 或日期`);
    assert(isNum(w.weightKg) && w.weightKg >= 30 && w.weightKg <= 300, `weightRecords[${i}] 体重超出范围`);
  });

  const tasks = value.dailyTasks ?? [];
  assert(Array.isArray(tasks), "dailyTasks 必须是数组");
  tasks.forEach((t, i) => {
    assert(isObj(t) && isStr(t.id) && isStr(t.date) && isStr(t.title), `dailyTasks[${i}] 结构不完整`);
    assert(typeof t.completed === "boolean", `dailyTasks[${i}] completed 必须是布尔值`);
  });

  // v1 → v2：没有模板字段的旧数据补默认模板；显式空数组保留（用户删光了）
  const templates = validateTemplates(value.mealTemplates) ?? defaultTemplates;

  return {
    schemaVersion: SCHEMA_VERSION,
    profile: (profile as AppData["profile"]) ?? null,
    nutritionGoals: goals as AppData["nutritionGoals"],
    foodRecords: records as AppData["foodRecords"],
    weightRecords: weights as AppData["weightRecords"],
    dailyTasks: tasks as AppData["dailyTasks"],
    mealTemplates: templates,
  };
}

export function parseImport(text: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("文件不是合法的 JSON");
  }
  return validateAppData(raw);
}

/** 迁移入口：v1 数据补 mealTemplates 后按 v2 校验，未来版本在此逐级转换。 */
export function migrate(raw: unknown): AppData {
  return validateAppData(raw);
}

export { emptyAppData };
