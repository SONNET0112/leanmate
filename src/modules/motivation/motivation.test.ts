import { describe, expect, it } from "vitest";
import { motivationFor, pickCategory } from "./motivation.service";
import type { MotivationContext } from "./motivation.types";

const base: MotivationContext = {
  hasRecordsToday: true,
  recordCount: 3,
  streakDays: 1,
  calorieTarget: 2000,
  caloriesConsumed: 1200,
  proteinTarget: 130,
  proteinConsumed: 100,
  weightDeltaKg: null,
};

describe("pickCategory", () => {
  it("无记录时为 noPlan", () => {
    expect(pickCategory({ ...base, hasRecordsToday: false, recordCount: 0 })).toBe("noPlan");
  });
  it("只有一条记录时鼓励首次记录", () => {
    expect(pickCategory({ ...base, recordCount: 1 })).toBe("firstRecord");
  });
  it("明显超标时提示超额", () => {
    expect(pickCategory({ ...base, caloriesConsumed: 2400 })).toBe("overTarget");
  });
  it("蛋白质不足时提示补蛋白", () => {
    expect(pickCategory({ ...base, proteinConsumed: 40 })).toBe("proteinGap");
  });
});

describe("motivationFor", () => {
  it("同一天返回同一条文案", () => {
    expect(motivationFor(base, "2026-10-28")).toBe(motivationFor(base, "2026-10-28"));
  });
  it("文案非空", () => {
    expect(motivationFor(base, "2026-10-28").length).toBeGreaterThan(0);
  });
});
