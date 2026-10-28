import { describe, expect, it } from "vitest";
import { defaultTemplates, newTemplate, removeTemplate, templateNutrition, upsertTemplate, validateTemplate } from "./templates";

describe("templates", () => {
  it("默认模板都有营养汇总", () => {
    for (const template of defaultTemplates) {
      const { totals, missing } = templateNutrition(template);
      expect(missing).toHaveLength(0);
      expect(totals.caloriesKcal).toBeGreaterThan(0);
    }
  });

  it("缺失食物被单独报出而不是算成 0", () => {
    const { missing, totals } = templateNutrition({
      id: "x",
      name: "坏模板",
      mealType: "lunch",
      note: "",
      items: [{ foodId: "not-exist", amountG: 100 }],
    });
    expect(missing).toEqual(["not-exist"]);
    expect(totals.caloriesKcal).toBe(0);
  });

  it("校验拦下空名称、空食物与越界克数", () => {
    expect(validateTemplate(newTemplate())).toContain("至少需要一个食物");
    expect(validateTemplate({ ...newTemplate(), name: " " })).toContain("名称");
    expect(validateTemplate({ id: "a", name: "x", mealType: "lunch", note: "", items: [{ foodId: "not-exist", amountG: 100 }] })).toContain("食物库");
    expect(validateTemplate({ id: "a", name: "x", mealType: "lunch", note: "", items: [{ foodId: "rice-cooked", amountG: 0 }] })).toContain("克数");
  });

  it("新增与更新都只留一份", () => {
    const template = { ...newTemplate(), name: "测试", items: [{ foodId: "rice-cooked", amountG: 100 }] };
    const created = upsertTemplate([], template);
    expect(created).toHaveLength(1);
    const updated = upsertTemplate(created, { ...template, name: "改名" });
    expect(updated).toHaveLength(1);
    expect(updated[0].name).toBe("改名");
  });

  it("删除模板", () => {
    const template = newTemplate();
    expect(removeTemplate(upsertTemplate([], template), template.id)).toHaveLength(0);
  });
});
