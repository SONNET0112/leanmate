import { Trash2 } from "lucide-react";
import { mealTotals } from "../../modules/records/records.service";
import { FOOD_STATE_LABEL } from "../../modules/nutrition/nutrition.types";
import { MEAL_LABEL } from "../../modules/records/records.types";
import type { FoodRecord } from "../../modules/records/records.types";
import { grams } from "../../utils/format";

export function MealRecords({
  records,
  date,
  onAmount,
  onDelete,
}: {
  records: FoodRecord[];
  date: string;
  onAmount: (id: string, amountG: number) => void;
  onDelete: (record: FoodRecord) => void;
}) {
  const meals = mealTotals(records, date);
  const filled = meals.filter((m) => m.count > 0);

  if (!filled.length) {
    return (
      <section className="card px-5 py-8 text-center">
        <p className="text-[14px]">这一天还没有饮食记录</p>
        <p className="mt-1 text-[13px] text-muted">用搜索或 AI 识别添加第一项，热量和蛋白质会自动计算。</p>
      </section>
    );
  }

  return (
    <>
      {filled.map(({ mealType, totals, count }) => (
        <section key={mealType} className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <h2 className="text-[13px] font-medium text-muted">{MEAL_LABEL[mealType]}</h2>
            <span className="text-[12px] text-muted">
              {count} 项 · {Math.round(totals.caloriesKcal)} kcal
            </span>
          </div>
          <ul className="divide-y divide-line">
            {records
              .filter((r) => r.mealType === mealType)
              .map((record) => (
                <li key={record.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">{record.foodNameSnapshot}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {FOOD_STATE_LABEL[record.foodState]} · 蛋白 {grams(record.nutritionSnapshot.proteinG)} g · 碳水{" "}
                      {grams(record.nutritionSnapshot.carbohydratesG)} g
                    </p>
                  </div>
                  <label className="flex items-center gap-1 text-[12px] text-muted">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={1}
                      max={10000}
                      defaultValue={record.amountG}
                      key={`${record.id}-${record.amountG}`}
                      onBlur={(e) => {
                        const next = Number(e.target.value);
                        if (Number.isFinite(next) && next > 0 && next !== record.amountG) onAmount(record.id, next);
                        else e.target.value = String(record.amountG);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      className="w-16 rounded-lg border border-line px-2 py-1 text-right text-ink"
                      aria-label={`${record.foodNameSnapshot} 克数`}
                    />
                    g
                  </label>
                  <span className="w-16 text-right text-[13px]">
                    {Math.round(record.nutritionSnapshot.caloriesKcal)}
                    <span className="ml-0.5 text-[10px] text-muted">kcal</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onDelete(record)}
                    className="rounded-lg p-1.5 text-muted hover:bg-[#faf1f0] hover:text-danger"
                    aria-label={`删除 ${record.foodNameSnapshot}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}
