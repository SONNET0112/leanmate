import { describe, expect, it } from "vitest";
import { decideSync, hasUserData } from "./cloud.storage";
import { emptyAppData, type AppData } from "../../storage/storage.interface";

const withProfile = (): AppData => ({
  ...emptyAppData(),
  profile: {
    id: "p1",
    sex: "female",
    age: 28,
    heightCm: 165,
    currentWeightKg: 65,
    targetWeightKg: 58,
    weeklyExerciseHours: 3,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
});

describe("hasUserData", () => {
  it("空数据算没有内容", () => {
    expect(hasUserData(emptyAppData())).toBe(false);
    expect(hasUserData(null)).toBe(false);
  });

  it("有资料或记录就算有内容", () => {
    expect(hasUserData(withProfile())).toBe(true);
    const record = { ...emptyAppData(), foodRecords: [{ id: "r1" } as never] };
    expect(hasUserData(record)).toBe(true);
  });
});

describe("decideSync", () => {
  it("云端有数据一律拉云端，不用本地覆盖", () => {
    expect(decideSync(withProfile(), withProfile())).toBe("pull");
    expect(decideSync(emptyAppData(), withProfile())).toBe("pull");
  });

  it("云端为空、本地有数据时推送（首次迁移）", () => {
    expect(decideSync(withProfile(), null)).toBe("push");
  });

  it("两边都空时什么都不做", () => {
    expect(decideSync(emptyAppData(), null)).toBe("none");
    expect(decideSync(null, null)).toBe("none");
  });
});
