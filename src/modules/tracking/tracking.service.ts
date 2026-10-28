import { addDays, daysBetween } from "../../utils/date";
import type { WeightRecord } from "./tracking.types";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `w-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function validateWeight(weightKg: number): string | null {
  if (!Number.isFinite(weightKg)) return "体重必须是数字";
  if (weightKg < 30 || weightKg > 300) return "体重需在 30–300 kg 之间";
  return null;
}

/** 同一天只保留一条：重复录入视为修正，覆盖当天记录（保留原 id）。 */
export function upsertWeightRecord(
  records: WeightRecord[],
  input: { date: string; weightKg: number; note?: string },
): WeightRecord[] {
  const error = validateWeight(input.weightKg);
  if (error) throw new Error(error);
  const existing = records.find((r) => r.date === input.date);
  if (existing) {
    return records.map((r) => (r.date === input.date ? { ...r, weightKg: input.weightKg, note: input.note ?? r.note } : r));
  }
  return [...records, { id: newId(), date: input.date, weightKg: input.weightKg, note: input.note, createdAt: new Date().toISOString() }];
}

/** 编辑已有记录（可改日期）；改到已被占用的日期时拒绝，避免同日两条。 */
export function updateWeightRecord(
  records: WeightRecord[],
  id: string,
  patch: { date?: string; weightKg?: number; note?: string },
): WeightRecord[] {
  const target = records.find((r) => r.id === id);
  if (!target) throw new Error("记录不存在");
  const weightKg = patch.weightKg ?? target.weightKg;
  const error = validateWeight(weightKg);
  if (error) throw new Error(error);
  const date = patch.date ?? target.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("日期格式不正确");
  if (records.some((r) => r.id !== id && r.date === date)) throw new Error("该日期已有体重记录，请直接修改那一条");
  return records.map((r) => (r.id === id ? { ...r, date, weightKg, note: patch.note ?? r.note } : r));
}

export function deleteWeightRecord(records: WeightRecord[], id: string): WeightRecord[] {
  return records.filter((r) => r.id !== id);
}

export function weightForDate(records: WeightRecord[], date: string): WeightRecord | undefined {
  return records.find((r) => r.date === date);
}

/** 截至 endDate 的 7 日平均，只用实际测量值，缺测日不插值。 */
export function sevenDayAverage(records: WeightRecord[], endDate: string): number | null {
  const start = addDays(endDate, -6);
  const window = records.filter((r) => r.date >= start && r.date <= endDate);
  if (!window.length) return null;
  const sum = window.reduce((acc, r) => acc + r.weightKg, 0);
  return Math.round((sum / window.length) * 10) / 10;
}

export function weightSeries(records: WeightRecord[], days = 30, endDate: Date | string = new Date()): { date: string; weightKg: number }[] {
  const end =
    typeof endDate === "string" ? endDate : `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
  const start = addDays(end, -(days - 1));
  return [...records]
    .filter((r) => r.date >= start && r.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => ({ date: r.date, weightKg: r.weightKg }));
}

export function weightChange(records: WeightRecord[]): { latest?: WeightRecord; deltaKg: number | null } {
  if (!records.length) return { deltaKg: null };
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : undefined;
  return { latest, deltaKg: previous ? Math.round((latest.weightKg - previous.weightKg) * 10) / 10 : null };
}

export function daysSinceLastWeight(records: WeightRecord[], today: string): number | null {
  if (!records.length) return null;
  const latest = [...records].sort((a, b) => a.date.localeCompare(b.date)).pop()!;
  return daysBetween(latest.date, today);
}
