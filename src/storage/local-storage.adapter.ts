import { migrate } from "./storage.migration";
import { emptyAppData, type AppData, type StorageAdapter } from "./storage.interface";

const KEY = "leanmate.data";

export class LocalStorageAdapter implements StorageAdapter {
  /** 浏览器禁用/无痕模式导致 localStorage 不可用时，退化为内存存储并告知用户 */
  persistent = true;
  private memory: AppData = emptyAppData();

  async load(): Promise<AppData> {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyAppData();
      try {
        this.memory = migrate(JSON.parse(raw));
        return this.memory;
      } catch (error) {
        // 本地数据损坏：原文另存一份，避免直接覆盖用户数据
        try {
          localStorage.setItem(`${KEY}.corrupt`, raw);
        } catch {
          /* 忽略：坏数据备份失败不影响启动 */
        }
        console.error("LeanMate 本地数据无法读取", error);
        return emptyAppData();
      }
    } catch {
      this.persistent = false;
      return this.memory;
    }
  }

  async save(data: AppData): Promise<void> {
    this.memory = data;
    if (!this.persistent) throw new Error("浏览器存储不可用，本次修改只保留在内存中，刷新后会丢失");
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (error) {
      const quota = /quota/i.test(`${(error as Error).name} ${(error as Error).message}`);
      throw new Error(quota ? "浏览器存储空间已满，请先导出备份再清理旧记录" : "写入本地存储失败，本次修改可能未保存");
    }
  }

  async clear(): Promise<void> {
    this.memory = emptyAppData();
    if (!this.persistent) return;
    localStorage.removeItem(KEY);
  }
}

export const storage = new LocalStorageAdapter();
