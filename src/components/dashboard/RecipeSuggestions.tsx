import { useState } from "react";
import { Plus, Salad } from "lucide-react";
import { Link } from "react-router-dom";
import { templateNutrition, type MealTemplate } from "../../modules/plan/templates";
import { MEAL_LABEL } from "../../modules/records/records.types";

export function RecipeSuggestions({
  templates,
  onAdd,
}: {
  templates: MealTemplate[];
  onAdd: (template: MealTemplate) => { added: number; missing: number };
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const list = templates.slice(0, 1);

  return (
    <section className="card flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-muted">推荐食谱</h2>
        <Link to="/plan" className="text-[12px] text-primary hover:underline">
          查看全部
        </Link>
      </div>

      {list.length ? (
        <ul className="mt-3 space-y-2">
          {list.map((template) => {
            const { totals } = templateNutrition(template);
            return (
              <li key={template.id} className="rounded-2xl border border-line/80 p-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#f1f6ea] text-primary-deep">
                    <Salad size={15} strokeWidth={1.8} aria-hidden />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-[13px]">{template.name}</p>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  {MEAL_LABEL[template.mealType]} · 约 {Math.round(totals.caloriesKcal)} kcal · {template.items.length} 项
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const result = onAdd(template);
                    setNotice(result.added ? `已加入 ${result.added} 项` : "模板里没有可写入的食物");
                  }}
                  className="mt-2 w-full rounded-xl border border-line py-1.5 text-[11.5px] text-primary-deep hover:bg-primary-soft/60"
                  aria-label={`加入 ${template.name}`}
                >
                  <Plus size={12} className="inline" aria-hidden /> 加入今日饮食
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-[12px] leading-relaxed text-muted">还没有食谱模板，去「计划」页拼一份常吃的组合。</p>
      )}

      {notice ? <p className="mt-auto pt-2 text-[11px] text-primary">{notice}</p> : null}
    </section>
  );
}
