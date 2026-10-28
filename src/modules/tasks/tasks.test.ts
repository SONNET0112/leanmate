import { describe, expect, it } from "vitest";
import { completedCount, ensureDailyTasks, tasksForDate, toggleTask } from "./tasks.service";

describe("daily tasks", () => {
  it("首次进入某天时生成默认任务", () => {
    const tasks = ensureDailyTasks([], "2026-10-28");
    expect(tasksForDate(tasks, "2026-10-28")).toHaveLength(3);
  });

  it("同一天重复调用不会重复生成", () => {
    const once = ensureDailyTasks([], "2026-10-28");
    expect(ensureDailyTasks(once, "2026-10-28")).toHaveLength(3);
  });

  it("新的一天是未完成状态，不受昨天影响", () => {
    let tasks = ensureDailyTasks([], "2026-10-27");
    tasks = tasks.map((t) => ({ ...t, completed: true }));
    tasks = ensureDailyTasks(tasks, "2026-10-28");
    expect(completedCount(tasksForDate(tasks, "2026-10-28"))).toBe(0);
  });

  it("切换完成状态并记录完成时间", () => {
    let tasks = ensureDailyTasks([], "2026-10-28");
    tasks = toggleTask(tasks, tasks[0].id);
    expect(tasks[0].completed).toBe(true);
    expect(tasks[0].completedAt).toBeTruthy();
    tasks = toggleTask(tasks, tasks[0].id);
    expect(tasks[0].completed).toBe(false);
    expect(tasks[0].completedAt).toBeUndefined();
  });
});
