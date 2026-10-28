import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { calculateFoodNutrition } from "../../modules/nutrition/nutrition.calculator";
import { foods, searchFoods } from "../../modules/nutrition/nutrition.service";
import { FOOD_STATE_LABEL, type Food } from "../../modules/nutrition/nutrition.types";
import { MEAL_LABEL, MEAL_ORDER, type MealType } from "../../modules/records/records.types";
import { grams } from "../../utils/format";

export function FoodSearch({
  date,
  defaultMeal,
  recentFoods,
  onAdd,
}: {
  date: string;
  defaultMeal: MealType;
  recentFoods: Food[];
  onAdd: (food: Food, amountG: number, mealType: MealType) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Food | null>(null);
  const [amount, setAmount] = useState("100");
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [error, setError] = useState<string | null>(null);

  const results = searchFoods(query);
  const parsed = Number(amount);
  let preview = null;
  if (selected && Number.isFinite(parsed) && parsed > 0) {
    try {
      preview = calculateFoodNutrition(selected, parsed);
    } catch {
      preview = null;
    }
  }

  const pick = (food: Food) => {
    setSelected(food);
    setMealType(defaultMeal);
    setError(null);
  };

  const confirmAdd = () => {
    if (!selected) return;
    setError(null);
    if (!preview) {
      setError("请输入 1–10000 克之间的重量");
      return;
    }
    onAdd(selected, parsed, mealType);
    setSelected(null);
    setQuery("");
    setAmount("100");
  };

  return (
    <section className="card p-4">
      <label className="relative block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          placeholder="搜索食物，例如鸡胸肉、米饭"
          className="field pl-9"
          aria-label="搜索食物"
        />
      </label>

      {recentFoods.length > 0 && !query && !selected ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted">常吃：</span>
          {recentFoods.map((food) => (
            <button
              key={food.id}
              type="button"
              onClick={() => pick(food)}
              className="rounded-full border border-line px-2.5 py-1 text-[12px] text-muted hover:border-primary hover:text-ink"
            >
              {food.name}
            </button>
          ))}
        </div>
      ) : null}

      {selected ? (
        <div className="mt-3 rounded-xl border border-line p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[15px] font-medium">{selected.name}</h3>
              <p className="mt-0.5 text-[12px] text-muted">
                {FOOD_STATE_LABEL[selected.state]} · 每 100g {Math.round(selected.nutritionPer100g.caloriesKcal)} kcal
                {selected.sourceType === "estimated" ? " · 估算值" : ""}
              </p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="rounded-lg p-1 text-muted hover:text-ink" aria-label="取消选择">
              <X size={16} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {MEAL_ORDER.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMealType(m)}
                className={`rounded-full px-3 py-1 text-[13px] ${mealType === m ? "bg-primary text-white" : "border border-line text-muted hover:text-ink"}`}
              >
                {MEAL_LABEL[m]}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="field w-24 text-right"
              aria-label="食物克数"
            />
            <span className="text-[13px] text-muted">克</span>
            {[50, 100, 150, 200].map((g) => (
              <button key={g} type="button" onClick={() => setAmount(String(g))} className="rounded-lg border border-line px-2 py-1 text-[12px] text-muted hover:text-ink">
                {g}g
              </button>
            ))}
          </div>

          {preview ? (
            <dl className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-[#fafbf8] p-3 text-center">
              <div>
                <dt className="text-[11px] text-muted">热量</dt>
                <dd className="text-[14px]">{Math.round(preview.caloriesKcal)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted">蛋白</dt>
                <dd className="text-[14px]">{grams(preview.proteinG)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted">碳水</dt>
                <dd className="text-[14px]">{grams(preview.carbohydratesG)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted">脂肪</dt>
                <dd className="text-[14px]">{grams(preview.fatG)}</dd>
              </div>
            </dl>
          ) : null}

          {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}

          <p className="mt-3 text-[11px] leading-relaxed text-muted" title={selected.source}>
            数据来源：{selected.source}。添加后保存当前营养快照（{date}），之后不随食物库变化。
          </p>

          <button type="button" onClick={confirmAdd} className="btn btn-primary mt-3 w-full">
            <Plus size={15} /> 添加到{MEAL_LABEL[mealType]}
          </button>
        </div>
      ) : query ? (
        <ul className="mt-3 divide-y divide-line/70">
          {results.map((food) => (
            <li key={food.id}>
              <button type="button" onClick={() => pick(food)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-[#fafbf8]">
                <span className="min-w-0">
                  <span className="block truncate text-[14px]">{food.name}</span>
                  <span className="text-[12px] text-muted">
                    {food.category} · {FOOD_STATE_LABEL[food.state]}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[13px] text-muted">
                  {Math.round(food.nutritionPer100g.caloriesKcal)} kcal / 100g
                  <Plus size={14} aria-hidden />
                </span>
              </button>
            </li>
          ))}
          {!results.length ? <li className="py-6 text-center text-[13px] text-muted">没有匹配的食物，换个关键词试试。</li> : null}
        </ul>
      ) : (
        <p className="mt-3 text-[12px] text-muted">输入关键词搜索食物库（{foods.length} 种），或点上面的常吃食物。</p>
      )}
    </section>
  );
}
