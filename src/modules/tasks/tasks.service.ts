import type { DailyTask, DailyTaskType } from "./tasks.types";

const DEFAULT_TASKS: { type: DailyTaskType; title: string }[] = [
  { type: "meal", title: "记录三餐" },
  { type: "water", title: "喝够 8 杯水" },
  { type: "weight", title: "记录今天的体重" },
];

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** 任务按日期隔离：昨天完成的任务不会变成今天已完成。 */
export function ensureDailyTasks(tasks: DailyTask[], date: string): DailyTask[] {
  if (tasks.some((t) => t.date === date)) return tasks;
  return [...tasks, ...DEFAULT_TASKS.map((d) => ({ id: newId(), date, type: d.type, title: d.title, completed: false }))];
}

export function tasksForDate(tasks: DailyTask[], date: string): DailyTask[] {
  return tasks.filter((t) => t.date === date);
}

export function toggleTask(tasks: DailyTask[], id: string): DailyTask[] {
  return tasks.map((t) =>
    t.id === id
      ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
      : t,
  );
}

export function completedCount(tasks: DailyTask[]): number {
  return tasks.filter((t) => t.completed).length;
}
