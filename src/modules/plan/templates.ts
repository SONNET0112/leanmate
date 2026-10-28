import templatesJson from "../../data/meal-templates.json";
import { calculateFoodNutrition, emptyTotals, sumNutrition } from "../nutrition/nutrition.calculator";
import { findFood } from "../nutrition/nutrition.service";
import type { NutritionTotals } from "../nutrition/nutrition.types";
import type { MealType } from "../records/records.types";

export interface TemplateItem {
  foodId: string;
  amountG: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  mealType: MealType;
  note: string;
  items: TemplateItem[];
}

export const defaultTemplates: MealTemplate[] = templatesJson.templates as MealTemplate[];

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tpl-${Date.now()}`;

export function newTemplate(mealType: MealType = "lunch"): MealTemplate {
  return { id: newId(), name: "新模板", mealType, note: "", items: [] };
}

/** 模板营养汇总；缺失食物单独返回，供 UI 提示，不静默忽略成 0。 */
export function templateNutrition(template: MealTemplate): { totals: NutritionTotals; missing: string[] } {
  const missing: string[] = [];
  const totals = template.items.length
    ? sumNutrition(
        template.items.flatMap((item) => {
          const food = findFood(item.foodId);
          if (!food) {
            missing.push(item.foodId);
            return [];
          }
          return [calculateFoodNutrition(food, item.amountG)];
        }),
      )
    : emptyTotals();
  return { totals, missing };
}

export function validateTemplate(template: MealTemplate): string | null {
  if (!template.name.trim()) return "模板名称不能为空";
  if (!template.items.length) return "模板至少需要一个食物";
  for (const item of template.items) {
    if (!findFood(item.foodId)) return "模板中有食物已不在食物库";
    if (!Number.isFinite(item.amountG) || item.amountG <= 0 || item.amountG > 2000) return "模板食物克数需在 1–2000 之间";
  }
  return null;
}

export function upsertTemplate(list: MealTemplate[], template: MealTemplate): MealTemplate[] {
  const exists = list.some((t) => t.id === template.id);
  return exists ? list.map((t) => (t.id === template.id ? template : t)) : [...list, template];
}

export function removeTemplate(list: MealTemplate[], id: string): MealTemplate[] {
  return list.filter((t) => t.id !== id);
}
