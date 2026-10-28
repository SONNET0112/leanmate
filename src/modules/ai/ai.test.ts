import { describe, expect, it } from "vitest";
import { parseMealLocally } from "./local-parser";
import { scale, toDraftItems } from "./ai.client";

describe("toDraftItems", () => {
  const base = {
    name: "红烧肉",
    foodId: null,
    amountG: 150,
    mealType: "lunch",
    confidence: 0.6,
    basis: "一份约150g",
    per100g: { caloriesKcal: 330, proteinG: 14, carbohydratesG: 3, fatG: 29 },
  };

  it("库内食物优先用数据库数值，并标记来源", () => {
    const [item] = toDraftItems({ items: [{ ...base, name: "米饭", foodId: "rice-cooked" }] });
    expect(item.source).toBe("database");
    expect(item.name).toBe("米饭（熟）");
    expect(item.per100g.caloriesKcal).toBe(116);
    expect(item.nutrition.caloriesKcal).toBeCloseTo(174, 0);
  });

  it("库外食物用模型估算值并标注 model-estimate", () => {
    const [item] = toDraftItems({ items: [base] });
    expect(item.source).toBe("model-estimate");
    expect(item.nutrition.fatG).toBeCloseTo(43.5, 1);
  });

  it("伪造或越界的 foodId 被丢弃，不会被当成库内数据", () => {
    const [item] = toDraftItems({ items: [{ ...base, foodId: "../../etc/passwd" }] });
    expect(item.foodId).toBeNull();
    expect(item.source).toBe("model-estimate");
  });

  it("重量、置信度越界时被裁剪", () => {
    const [item] = toDraftItems({ items: [{ ...base, amountG: 99999, confidence: 42 }] });
    expect(item.amountG).toBe(2000);
    expect(item.confidence).toBe(1);
  });

  it("缺少名称或结构错误时丢弃条目", () => {
    expect(toDraftItems({ items: [{ ...base, name: "" }] })).toHaveLength(0);
    expect(toDraftItems(null)).toHaveLength(0);
    expect(toDraftItems({ items: "nope" })).toHaveLength(0);
  });

  it("超过 10 条只取前 10 条", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ ...base, name: `食物${i}` }));
    expect(toDraftItems({ items: many })).toHaveLength(10);
  });
});

describe("parseMealLocally", () => {
  it("匹配库内食物并换算碗数", () => {
    const { items, unmatched } = parseMealLocally("中午吃了一碗米饭");
    expect(items[0].foodId).toBe("rice-cooked");
    expect(items[0].amountG).toBe(200);
    expect(items[0].mealType).toBe("lunch");
    expect(unmatched).toHaveLength(0);
  });

  it("按克数解析", () => {
    const { items } = parseMealLocally("晚上吃了150克鸡胸肉");
    expect(items[0].amountG).toBe(150);
    expect(items[0].mealType).toBe("dinner");
    expect(items[0].nutrition.proteinG).toBeCloseTo(33.8, 1);
  });

  it("库里没有的食物进入未匹配列表，不编造数据", () => {
    const { items, unmatched } = parseMealLocally("中午吃了一碗米饭、一份红烧肉和一份炒青菜");
    expect(items).toHaveLength(1);
    expect(unmatched.join(",")).toContain("红烧肉");
  });

  it("别名也能匹配", () => {
    const { items } = parseMealLocally("早餐两个鸡蛋");
    expect(items[0].name).toContain("鸡蛋");
    expect(items[0].amountG).toBe(100);
  });
});

describe("scale", () => {
  it("按重量线性换算并保留 1 位小数", () => {
    expect(scale({ caloriesKcal: 100, proteinG: 10, carbohydratesG: 20, fatG: 5 }, 250).proteinG).toBe(25);
  });
});
