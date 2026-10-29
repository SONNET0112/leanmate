import type { AppData } from "../../storage/storage.interface";
import { migrate } from "../../storage/storage.migration";
import { supabase } from "./supabase";

const TABLE = "leanmate_state";
const BACKUP_PREFIX = "leanmate.backup.";
const MIGRATED_PREFIX = "leanmate.migrated.";
const LAST_USER_KEY = "leanmate.lastUser";

/** 首次登录时的合并动作：云端有数据一律以云端为准，绝不用本地覆盖云端。 */
export type SyncAction = "pull" | "push" | "reset" | "none";

export interface SyncContext {
  userId?: string;
  /** 本机缓存上次属于哪个账号；换了账号就不能把旧账号的数据推进新账号 */
  lastUserId?: string | null;
}

export function readLastUser(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export function rememberUser(userId: string): void {
  try {
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    /* 忽略 */
  }
}

export function forgetUser(): void {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    /* 忽略 */
  }
}

export function hasUserData(data: AppData | null): boolean {
  if (!data) return false;
  return (
    Boolean(data.profile) ||
    data.foodRecords.length > 0 ||
    data.weightRecords.length > 0 ||
    data.nutritionGoals.length > 0
  );
}

export function decideSync(local: AppData | null, remote: AppData | null, ctx: SyncContext = {}): SyncAction {
  if (remote) return "pull";
  if (!hasUserData(local)) return "none";
  // 换账号登录且云端为空：本机还留着上一个账号的缓存，绝不能把它推进新账号
  if (ctx.lastUserId && ctx.userId && ctx.lastUserId !== ctx.userId) return "reset";
  return "push";
}

export async function loadRemote(userId: string): Promise<AppData | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from(TABLE).select("data").eq("id", userId).maybeSingle();
  if (error) throw new Error(`云端读取失败：${error.message}`);
  if (!data?.data) return null;
  // 云端数据同样走一遍结构校验，坏数据不覆盖本地
  return migrate(data.data);
}

export async function saveRemote(userId: string, data: AppData): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from(TABLE)
    .upsert({ id: userId, data, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(`云端保存失败：${error.message}`);
}

/** 覆盖前把本地原样留一份，迁移出问题可以手工找回。 */
export function backupLocal(userId: string, data: AppData): void {
  try {
    localStorage.setItem(BACKUP_PREFIX + userId, JSON.stringify(data));
  } catch {
    /* 空间不足时放弃备份，不阻断登录 */
  }
}

export function markMigrated(userId: string): void {
  try {
    localStorage.setItem(MIGRATED_PREFIX + userId, new Date().toISOString());
  } catch {
    /* 忽略 */
  }
}

export function migrationStatus(userId: string): "done" | "pending" {
  try {
    return localStorage.getItem(MIGRATED_PREFIX + userId) ? "done" : "pending";
  } catch {
    return "pending";
  }
}
