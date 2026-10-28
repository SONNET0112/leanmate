import { describe, expect, it } from "vitest";
import { addDays } from "../../utils/date";
import { deleteWeightRecord, sevenDayAverage, upsertWeightRecord, weightChange } from "./tracking.service";
import type { WeightRecord } from "./tracking.types";

describe("upsertWeightRecord", () => {
  it("新增记录", () => {
    const records = upsertWeightRecord([], { date: "2026-10-28", weightKg: 80 });
    expect(records).toHaveLength(1);
  });

  it("同一天重复录入更新原记录而不是新增", () => {
    let records = upsertWeightRecord([], { date: "2026-10-28", weightKg: 80 });
    records = upsertWeightRecord(records, { date: "2026-10-28", weightKg: 79.4 });
    expect(records).toHaveLength(1);
    expect(records[0].weightKg).toBe(79.4);
  });

  it("越界体重被拒绝", () => {
    expect(() => upsertWeightRecord([], { date: "2026-10-28", weightKg: 5 })).toThrow();
    expect(() => upsertWeightRecord([], { date: "2026-10-28", weightKg: 500 })).toThrow();
  });
});

describe("deleteWeightRecord", () => {
  it("删除指定记录", () => {
    const records = upsertWeightRecord([], { date: "2026-10-28", weightKg: 80 });
    expect(deleteWeightRecord(records, records[0].id)).toHaveLength(0);
  });
});

describe("sevenDayAverage", () => {
  it("只统计 7 天窗口内的实测值", () => {
    const records: WeightRecord[] = [
      { id: "1", date: "2026-10-28", weightKg: 80, createdAt: "" },
      { id: "2", date: "2026-10-26", weightKg: 79, createdAt: "" },
      { id: "3", date: "2026-10-20", weightKg: 90, createdAt: "" },
    ];
    expect(sevenDayAverage(records, "2026-10-28")).toBe(79.5);
  });

  it("窗口内无记录返回 null", () => {
    expect(sevenDayAverage([{ id: "1", date: "2026-01-01", weightKg: 80, createdAt: "" }], "2026-10-28")).toBeNull();
  });

  it("窗口边界包含第 7 天前", () => {
    const start = addDays("2026-10-28", -6);
    const records: WeightRecord[] = [{ id: "1", date: start, weightKg: 81, createdAt: "" }];
    expect(sevenDayAverage(records, "2026-10-28")).toBe(81);
  });
});

describe("weightChange", () => {
  it("计算相对上一次的变化", () => {
    const records: WeightRecord[] = [
      { id: "1", date: "2026-10-27", weightKg: 80.2, createdAt: "" },
      { id: "2", date: "2026-10-28", weightKg: 79.9, createdAt: "" },
    ];
    expect(weightChange(records).deltaKg).toBe(-0.3);
  });

  it("空历史返回 null", () => {
    expect(weightChange([]).deltaKg).toBeNull();
  });
});
