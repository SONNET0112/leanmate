import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { calculateFoodNutrition } from "../modules/nutrition/nutrition.calculator";
import { findFood } from "../modules/nutrition/nutrition.service";
import type { Food, FoodState, NutritionTotals } from "../modules/nutrition/nutrition.types";
import { computeNutritionGoal, type GoalComputation } from "../modules/plan/plan.service";
import type { UserProfile } from "../modules/plan/plan.types";
import { removeTemplate, upsertTemplate, type MealTemplate } from "../modules/plan/templates";
import { addFoodRecord, deleteFoodRecord, updateFoodRecord } from "../modules/records/records.service";
import type { MealType } from "../modules/records/records.types";
import { ensureDailyTasks, toggleTask } from "../modules/tasks/tasks.service";
import { deleteWeightRecord, updateWeightRecord, upsertWeightRecord } from "../modules/tracking/tracking.service";
import { emptyAppData, type AppData } from "../storage/storage.interface";
import { storage } from "../storage/local-storage.adapter";
import { toISODate } from "../utils/date";

interface RawRecordInput {
  date: string;
  mealType: MealType;
  foodId: string;
  foodName: string;
  amountG: number;
  foodState: FoodState;
  nutrition: NutritionTotals;
}

interface Store {
  data: AppData | null;
  today: string;
  storageError: string | null;
  createProfile(profile: Omit<UserProfile, "createdAt" | "updatedAt" | "id">): GoalComputation;
  updateProfile(profile: UserProfile): void;
  recomputeGoal(): GoalComputation | null;
  addRecord(input: { food: Food; amountG: number; mealType: MealType; date?: string }): void;
  addRawRecord(input: RawRecordInput): void;
  editRecord(id: string, patch: { amountG?: number; mealType?: MealType }): void;
  removeRecord(id: string): void;
  saveWeight(input: { date: string; weightKg: number; note?: string }): void;
  editWeight(id: string, patch: { date?: string; weightKg?: number; note?: string }): void;
  removeWeight(id: string): void;
  toggleTask(id: string): void;
  ensureTasks(date: string): void;
  saveTemplate(template: MealTemplate): void;
  deleteTemplate(id: string): void;
  addTemplateTo(date: string, template: MealTemplate, mealType?: MealType): { added: number; missing: number };
  replaceAll(data: AppData): void;
  reset(): void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const ref = useRef<AppData | null>(null);
  const today = toISODate();

  useEffect(() => {
    let cancelled = false;
    storage.load().then((loaded) => {
      if (cancelled) return;
      const withTasks: AppData = { ...loaded, dailyTasks: ensureDailyTasks(loaded.dailyTasks, toISODate()) };
      ref.current = withTasks;
      setData(withTasks);
      if (!storage.persistent) {
        setStorageError("浏览器存储不可用（可能是无痕模式或已禁用），本次数据只保存在内存中，刷新后会丢失。");
      }
      if (withTasks.dailyTasks !== loaded.dailyTasks) {
        void storage.save(withTasks).catch((error: Error) => setStorageError(error.message));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const store = useMemo<Store>(() => {
    const apply = (next: AppData) => {
      ref.current = next;
      setData(next);
      void storage.save(next).then(
        () => setStorageError(storage.persistent ? null : "浏览器存储不可用，数据只保存在内存中。"),
        (error: Error) => setStorageError(error.message),
      );
    };
    const mutate = (fn: (current: AppData) => AppData) => {
      const current = ref.current;
      if (!current) return;
      apply(fn(current));
    };
    const nowISO = () => new Date().toISOString();
    const newId = () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `id-${Date.now()}`;

    return {
      data,
      today,
      storageError,
      createProfile(input) {
        const profile: UserProfile = { ...input, id: newId(), createdAt: nowISO(), updatedAt: nowISO() };
        const computed = computeNutritionGoal(profile, toISODate());
        mutate((current) => ({ ...current, profile, nutritionGoals: [...current.nutritionGoals, computed.goal] }));
        return computed;
      },
      updateProfile(profile) {
        mutate((current) => ({ ...current, profile: { ...profile, updatedAt: nowISO() } }));
      },
      recomputeGoal() {
        const profile = ref.current?.profile;
        if (!profile) return null;
        const computed = computeNutritionGoal(profile, toISODate());
        mutate((current) => ({ ...current, nutritionGoals: [...current.nutritionGoals, computed.goal] }));
        return computed;
      },
      addRecord({ food, amountG, mealType, date }) {
        const nutrition = calculateFoodNutrition(food, amountG);
        mutate((current) => ({
          ...current,
          foodRecords: addFoodRecord(
            current.foodRecords,
            { date: date ?? toISODate(), mealType, foodId: food.id, foodName: food.name, amountG, foodState: food.state, nutrition },
            nowISO(),
          ),
        }));
      },
      addRawRecord(input) {
        mutate((current) => ({
          ...current,
          foodRecords: addFoodRecord(current.foodRecords, input, nowISO()),
        }));
      },
      editRecord(id, patch) {
        mutate((current) => ({ ...current, foodRecords: updateFoodRecord(current.foodRecords, id, patch, nowISO()) }));
      },
      removeRecord(id) {
        mutate((current) => ({ ...current, foodRecords: deleteFoodRecord(current.foodRecords, id) }));
      },
      saveWeight({ date, weightKg, note }) {
        mutate((current) => ({
          ...current,
          weightRecords: upsertWeightRecord(current.weightRecords, { date, weightKg, note }),
          profile: current.profile ? { ...current.profile, currentWeightKg: weightKg, updatedAt: nowISO() } : null,
        }));
      },
      editWeight(id, patch) {
        mutate((current) => ({ ...current, weightRecords: updateWeightRecord(current.weightRecords, id, patch) }));
      },
      removeWeight(id) {
        mutate((current) => ({ ...current, weightRecords: deleteWeightRecord(current.weightRecords, id) }));
      },
      toggleTask(id) {
        mutate((current) => ({ ...current, dailyTasks: toggleTask(current.dailyTasks, id) }));
      },
      ensureTasks(date) {
        const current = ref.current;
        if (!current) return;
        const next = ensureDailyTasks(current.dailyTasks, date);
        if (next !== current.dailyTasks) apply({ ...current, dailyTasks: next });
      },
      saveTemplate(template) {
        mutate((current) => ({ ...current, mealTemplates: upsertTemplate(current.mealTemplates, template) }));
      },
      deleteTemplate(id) {
        mutate((current) => ({ ...current, mealTemplates: removeTemplate(current.mealTemplates, id) }));
      },
      addTemplateTo(date, template, mealType) {
        const current = ref.current;
        if (!current) return { added: 0, missing: 0 };
        let records = current.foodRecords;
        let added = 0;
        let missing = 0;
        for (const item of template.items) {
          const food = findFood(item.foodId);
          if (!food) {
            missing += 1;
            continue;
          }
          records = addFoodRecord(
            records,
            {
              date,
              mealType: mealType ?? template.mealType,
              foodId: food.id,
              foodName: food.name,
              amountG: item.amountG,
              foodState: food.state,
              nutrition: calculateFoodNutrition(food, item.amountG),
            },
            nowISO(),
          );
          added += 1;
        }
        apply({ ...current, foodRecords: records });
        return { added, missing };
      },
      replaceAll(next) {
        apply({ ...next, dailyTasks: ensureDailyTasks(next.dailyTasks, toISODate()) });
      },
      reset() {
        apply(emptyAppData());
        void storage.clear();
      },
    };
  }, [data, today, storageError]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore 必须在 StoreProvider 内使用");
  return store;
}

/** 派生：指定日期生效的目标版本（默认今天）。 */
export function useActiveGoal(date?: string) {
  const { data, today } = useStore();
  return useMemo(() => {
    if (!data) return null;
    const pool = data.nutritionGoals;
    if (!pool.length) return null;
    const target = date ?? today;
    const eligible = pool.filter((g) => g.effectiveFrom <= target);
    const sorted = (eligible.length ? eligible : pool).sort(
      (a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
    );
    return eligible.length ? sorted[sorted.length - 1] : sorted[0];
  }, [data, today, date]);
}
