export type DailyTaskType = "water" | "weight" | "meal" | "activity" | "custom";

export interface DailyTask {
  id: string;
  date: string;
  type: DailyTaskType;
  title: string;
  completed: boolean;
  completedAt?: string;
}
