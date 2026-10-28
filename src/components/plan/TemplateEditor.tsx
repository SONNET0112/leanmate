import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { findFood, foods } from "../../modules/nutrition/nutrition.service";
import { templateNutrition, validateTemplate, type MealTemplate } from "../../modules/plan/templates";
import { MEAL_LABEL, MEAL_ORDER, type MealType } from "../../modules/records/records.types";
import { grams } from "../../utils/format";

export function TemplateEditor({
  template,
  today,
  onSave,
  onDelete,
  onAddTo,
}: {
  template: MealTemplate;
  today: string;
  onSave: (template: MealTemplate) => void;
  onDelete: () => void;
  onAddTo: (date: string, mealType: MealType) => void;
}) {
  const [draft, setDraft] = useState<MealTemplate>(template);
  const [date, setDate] = useState(today);
  const [mealType, setMealType] = useState<MealType>(template.mealType);
  const [pickFoodId, setPickFoodId] = useState(foods[0].id);
  const [pickAmount, setPickAmount] = useState("100");
  const [message, setMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const { totals, missing } = templateNutrition(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(template);

  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-medium">{draft.name || "未命名模板"}</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            {MEAL_LABEL[draft.mealType]} · {Math.round(totals.caloriesKcal)} kcal · 蛋白 {grams(Math.round(totals.proteinG * 10) / 10)} g ·{" "}
            {draft.items.length} 项
          </p>
        </div>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="btn btn-ghost shrink-0 text-[12px]">
          {expanded ? "收起" : "编辑"}
        </button>
      </div>

      {missing.length ? <p className="mt-1 text-[11px] text-danger">有 {missing.length} 个食物已不在食物库，无法计入汇总。</p> : null}

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1 text-[12px] text-muted">
              加到
              <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className="rounded-lg border border-line px-2 py-1 text-ink" aria-label={`${draft.name} 目标日期`} />
            </label>
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value as MealType)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px]"
              aria-label={`${draft.name} 目标餐次`}
            >
              {MEAL_ORDER.map((m) => (
                <option key={m} value={m}>
                  {MEAL_LABEL[m]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                onAddTo(date, mealType);
                setMessage("已写入饮食记录");
              }}
              className="btn btn-ghost text-[12px]"
            >
              <Plus size={13} /> 写入记录
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="label">模板名称</span>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="field" aria-label="模板名称" />
            </label>
            <label className="block">
              <span className="label">默认餐次</span>
              <select
                value={draft.mealType}
                onChange={(e) => setDraft({ ...draft, mealType: e.target.value as MealType })}
                className="field"
                aria-label="模板默认餐次"
              >
                {MEAL_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {MEAL_LABEL[m]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ul className="space-y-1.5">
            {draft.items.map((item, index) => {
              const food = findFood(item.foodId);
              return (
                <li key={`${item.foodId}-${index}`} className="flex items-center gap-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate">{food?.name ?? item.foodId}</span>
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    value={item.amountG}
                    onChange={(e) => {
                      const next = Number(e.target.value);
                      setDraft({
                        ...draft,
                        items: draft.items.map((it, i) =>
                          i === index ? { ...it, amountG: Number.isFinite(next) ? Math.min(2000, Math.max(1, next)) : it.amountG } : it,
                        ),
                      });
                    }}
                    className="w-16 rounded-lg border border-line px-2 py-1 text-right"
                    aria-label={`${food?.name ?? "食物"} 克数`}
                  />
                  <span className="text-[11px] text-muted">g</span>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, items: draft.items.filter((_, i) => i !== index) })}
                    className="rounded-lg p-1 text-muted hover:text-danger"
                    aria-label={`移除 ${food?.name ?? "食物"}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              );
            })}
            {!draft.items.length ? <li className="text-[12px] text-muted">还没有食物，从下面添加。</li> : null}
          </ul>

          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="label">添加食物</span>
              <select value={pickFoodId} onChange={(e) => setPickFoodId(e.target.value)} className="field" aria-label="添加食物">
                {foods.map((food) => (
                  <option key={food.id} value={food.id}>
                    {food.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="w-24">
              <span className="label">克数</span>
              <input
                type="number"
                min={1}
                max={2000}
                value={pickAmount}
                onChange={(e) => setPickAmount(e.target.value)}
                className="field text-right"
                aria-label="添加食物克数"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                const amountG = Math.min(2000, Math.max(1, Number(pickAmount) || 100));
                setDraft({ ...draft, items: [...draft.items, { foodId: pickFoodId, amountG }] });
              }}
              className="btn btn-ghost h-[42px] text-[13px]"
            >
              <Plus size={14} /> 加入
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const problem = validateTemplate(draft);
                if (problem) {
                  setMessage(problem);
                  return;
                }
                onSave(draft);
                setMessage("已保存模板");
              }}
              className="btn btn-primary text-[13px]"
            >
              <Save size={14} /> 保存模板
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(template);
                setMessage("已还原");
              }}
              disabled={!dirty}
              className="btn btn-ghost text-[13px]"
            >
              还原
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`删除模板「${template.name}」？已写入的饮食记录不会受影响。`)) onDelete();
              }}
              className="btn btn-ghost text-[13px] text-danger"
            >
              <Trash2 size={14} /> 删除模板
            </button>
          </div>
          {message ? <p className="text-[11px] text-muted">{message}</p> : null}
        </div>
      ) : null}
    </article>
  );
}
