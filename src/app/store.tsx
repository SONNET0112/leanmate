import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../modules/auth/AuthProvider";
import {
  backupLocal,
  decideSync,
  hasUserData,
  loadRemote,
  markMigrated,
  readLastUser,
  rememberUser,
  saveRemote,
} from "../modules/cloud/cloud.storage";
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
  /** local = 未登录只看本机；syncing / synced / error 对应云端同步状态 */
  syncState: "local" | "syncing" | "synced" | "error";
  syncError: string | null;
  retrySync(): void;
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
  const { status: authStatus, user } = useAuth();
  const [data, setData] = useState<AppData | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<"local" | "syncing" | "synced" | "error">("local");
  const [syncError, setSyncError] = useState<string | null>(null);
  const ref = useRef<AppData | null>(null);
  const userIdRef = useRef<string | null>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<AppData | null>(null);
  /** 只有本会话成功对过云端之后才允许推送，避免把没核对过的本地数据盖上去 */
  const adoptedFor = useRef<string | null>(null);
  const clearPushTimer = () => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = null;
    pending.current = null;
  };
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

  const localReady = data !== null;

  useEffect(() => {
    if (authStatus !== "authed" || !user) {
      clearPushTimer();
      userIdRef.current = null;
      adoptedFor.current = null;
      setSyncState("local");
      return;
    }
    if (!localReady) return;
    userIdRef.current = user.id;
    let alive = true;
    setSyncState("syncing");
    (async () => {
      try {
        const local = ref.current;
        const remote = await loadRemote(user.id);
        if (!alive) return;
        const action = decideSync(local, remote, { userId: user.id, lastUserId: readLastUser() });
        if (action === "reset" && local) {
          // 换了账号：先把上一个账号的数据备份到它自己的 key 下，再给新账号一个干净的起点
          backupLocal(readLastUser() ?? user.id, local);
          const blank = emptyAppData();
          ref.current = blank;
          setData(blank);
          await storage.save(blank);
        }
        if (action === "pull" && remote) {
          // 云端优先：先把本地留一份备份，再切换过去，绝不用本地覆盖云端
          if (local && hasUserData(local)) backupLocal(user.id, local);
          ref.current = remote;
          setData(remote);
          await storage.save(remote);
          markMigrated(user.id);
        } else if (action === "push" && local) {
          backupLocal(user.id, local);
          await saveRemote(user.id, local);
          markMigrated(user.id);
        }
        if (!alive) return;
        adoptedFor.current = user.id;
        rememberUser(user.id);
        setSyncState("synced");
        setSyncError(null);
      } catch (error) {
        if (!alive) return;
        setSyncState("error");
        setSyncError(`${(error as Error).message}——本地数据没有改动，可稍后重试。`);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, user, localReady]);

  const store = useMemo<Store>(() => {
    const pushCloud = (next: AppData) => {
      const uid = userIdRef.current;
      if (!uid || adoptedFor.current !== uid) return;
      pending.current = next;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      setSyncState("syncing");
      pushTimer.current = setTimeout(() => {
        const payload = pending.current;
        const id = userIdRef.current;
        // 期间若切换了账号，这次推送直接作废，绝不写进别人的账号
        if (!payload || !id || id !== uid || adoptedFor.current !== uid) return;
        void saveRemote(id, payload).then(
          () => {
            setSyncState("synced");
            setSyncError(null);
          },
          (error: Error) => {
            setSyncState("error");
            setSyncError(`${error.message}——修改已存本机，可点重试同步。`);
          },
        );
      }, 800);
    };
    const apply = (next: AppData) => {
      ref.current = next;
      setData(next);
      void storage.save(next).then(
        () => setStorageError(storage.persistent ? null : "浏览器存储不可用，数据只保存在内存中。"),
        (error: Error) => setStorageError(error.message),
      );
      pushCloud(next);
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
      syncState,
      syncError,
      retrySync() {
        const uid = userIdRef.current;
        const current = ref.current;
        if (!uid || !current) return;
        setSyncState("syncing");
        void saveRemote(uid, current).then(
          () => {
            setSyncState("synced");
            setSyncError(null);
          },
          (error: Error) => {
            setSyncState("error");
            setSyncError(`${error.message}——本地数据没有丢，可稍后再试。`);
          },
        );
      },
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
  }, [data, today, storageError, syncState, syncError]);

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
