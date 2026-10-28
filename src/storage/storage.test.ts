import { describe, expect, it } from "vitest";
import { emptyAppData } from "./storage.interface";
import { parseImport, validateAppData } from "./storage.migration";

const valid = {
  schemaVersion: 1,
  profile: {
    id: "u1",
    sex: "male",
    age: 30,
    heightCm: 175,
    currentWeightKg: 80,
    targetWeightKg: 72,
    weeklyExerciseHours: 3,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
  },
  nutritionGoals: [
    {
      id: "g1",
      effectiveFrom: "2026-10-28",
      basisWeightKg: 80,
      dailyCaloriesKcal: 2300,
      proteinG: 128,
      carbohydratesG: 250,
      fatG: 70,
      calculationRuleVersion: "1.0.0",
      createdAt: "2026-10-28T00:00:00.000Z",
    },
  ],
  foodRecords: [],
  weightRecords: [{ id: "w1", date: "2026-10-28", weightKg: 80, createdAt: "" }],
  dailyTasks: [],
  mealTemplates: [],
};

describe("validateAppData", () => {
  it("接受合法数据", () => {
    expect(validateAppData(valid).profile?.id).toBe("u1");
  });

  it("拒绝缺少 schemaVersion", () => {
    expect(() => validateAppData({ ...valid, schemaVersion: undefined })).toThrow(/schemaVersion/);
  });

  it("拒绝未来版本", () => {
    expect(() => validateAppData({ ...valid, schemaVersion: 99 })).toThrow(/版本/);
  });

  it("拒绝非法餐次", () => {
    expect(() =>
      validateAppData({
        ...valid,
        foodRecords: [
          {
            id: "r1",
            date: "2026-10-28",
            mealType: "brunch",
            foodId: "x",
            foodNameSnapshot: "x",
            amountG: 100,
            foodState: "raw",
            nutritionSnapshot: { caloriesKcal: 1, proteinG: 1, carbohydratesG: 1, fatG: 1 },
            createdAt: "",
            updatedAt: "",
          },
        ],
      }),
    ).toThrow(/餐次/);
  });

  it("拒绝越界体重", () => {
    expect(() => validateAppData({ ...valid, weightRecords: [{ id: "w1", date: "2026-10-28", weightKg: 900 }] })).toThrow(/体重/);
  });

  it("缺少可选数组时补空数组", () => {
    const { schemaVersion, profile } = valid;
    const result = validateAppData({ schemaVersion, profile });
    expect(result.foodRecords).toEqual([]);
    expect(result.nutritionGoals).toEqual([]);
  });
});

describe("parseImport", () => {
  it("非法 JSON 给出明确错误", () => {
    expect(() => parseImport("{oops")).toThrow(/JSON/);
  });

  it("合法 JSON 解析出数据结构", () => {
    expect(parseImport(JSON.stringify(valid)).weightRecords).toHaveLength(1);
  });

  it("导入失败不产生半成品数据", () => {
    expect(() => parseImport(JSON.stringify({ schemaVersion: 1, foodRecords: "not-an-array" }))).toThrow();
  });
});

describe("emptyAppData", () => {
  it("初始状态没有档案与记录", () => {
    const data = emptyAppData();
    expect(data.profile).toBeNull();
    expect(data.schemaVersion).toBe(2);
    expect(data.mealTemplates.length).toBeGreaterThan(0);
  });
});

describe("迁移", () => {
  it("v1 数据缺少 mealTemplates 时补默认模板并升到 v2", () => {
    const { schemaVersion, profile, weightRecords } = valid;
    const migrated = validateAppData({ schemaVersion, profile, weightRecords });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.mealTemplates.length).toBeGreaterThan(0);
  });

  it("显式空模板数组保留（用户删光了不复活）", () => {
    expect(validateAppData({ ...valid, mealTemplates: [] }).mealTemplates).toEqual([]);
  });

  it("模板结构不合法时导入失败", () => {
    expect(() => validateAppData({ ...valid, mealTemplates: [{ id: "t1", name: "x", mealType: "brunch", items: [] }] })).toThrow(/餐次/);
  });
});
