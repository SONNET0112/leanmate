import { useMemo, useState } from "react";
import { AiMealPanel } from "../components/diet/AiMealPanel";
import { FoodSearch } from "../components/diet/FoodSearch";
import { MealRecords } from "../components/diet/MealRecords";
import { DateSwitcher } from "../components/common/DateSwitcher";
import { PageHeader } from "../components/layout/PageHeader";
import { useActiveGoal, useStore } from "../app/store";
import { useSelectedDate } from "../hooks/useSelectedDate";
import { findFood } from "../modules/nutrition/nutrition.service";
import type { Food } from "../modules/nutrition/nutrition.types";
import { defaultMealFor, getDailySummary } from "../modules/records/records.service";
import { addDays } from "../utils/date";
import { grams } from "../utils/format";

export function DietPage() {
  const { data, addRecord, addRawRecord, editRecord, removeRecord } = useStore();
  const { date, today, setDate } = useSelectedDate();
  const goal = useActiveGoal(date);
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;

  const records = data.foodRecords.filter((r) => r.date === date);
  const totals = getDailySummary(data.foodRecords, date);
  const defaultMeal = defaultMealFor(date, today);

  // 最近 30 天吃过的食物，用于快捷选择
  const recentFoods = useMemo<Food[]>(() => {
    const since = addDays(today, -30);
    const seen = new Set<string>();
    const list: Food[] = [];
    for (const record of [...data.foodRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
      if (record.date < since || seen.has(record.foodId)) continue;
      const food = findFood(record.foodId);
      if (!food) continue;
      seen.add(record.foodId);
      list.push(food);
      if (list.length >= 6) break;
    }
    return list;
  }, [data.foodRecords, today]);

  return (
    <div className="space-y-3">
      <PageHeader
        title="饮食记录"
        subtitle={`${date === today ? "今天" : date} · ${Math.round(totals.caloriesKcal)} kcal${goal ? ` / 目标 ${goal.dailyCaloriesKcal} kcal` : ""}`}
        action={<DateSwitcher date={date} today={today} onChange={setDate} />}
      />

      {error ? (
        <p className="rounded-xl border border-[#eed6d3] bg-[#fdf4f3] px-4 py-2.5 text-[13px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
        <div className="space-y-3">
          <AiMealPanel
            date={date}
            defaultMeal={defaultMeal}
            onSave={(items) => {
              for (const item of items) {
                addRawRecord({
                  date,
                  mealType: item.mealType,
                  foodId: item.foodId ?? `ai:${item.name}`,
                  foodName: item.name,
                  amountG: item.amountG,
                  foodState: item.foodState,
                  nutrition: item.nutrition,
                });
              }
            }}
          />
          <FoodSearch
            date={date}
            defaultMeal={defaultMeal}
            recentFoods={recentFoods}
            onAdd={(food, amountG, mealType) => {
              try {
                addRecord({ food, amountG, mealType, date });
              } catch (e) {
                setError(e instanceof Error ? e.message : "添加失败");
              }
            }}
          />
        </div>

        <div className="space-y-3">
          <section className="card grid grid-cols-4 gap-2 px-4 py-3 text-center">
            <div>
              <p className="text-[11px] text-muted">热量</p>
              <p className="text-[15px]">{Math.round(totals.caloriesKcal)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">蛋白</p>
              <p className="text-[15px]">{grams(Math.round(totals.proteinG * 10) / 10)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">碳水</p>
              <p className="text-[15px]">{grams(Math.round(totals.carbohydratesG * 10) / 10)}</p>
            </div>
            <div>
              <p className="text-[11px] text-muted">脂肪</p>
              <p className="text-[15px]">{grams(Math.round(totals.fatG * 10) / 10)}</p>
            </div>
          </section>

          <MealRecords
            records={records}
            date={date}
            onAmount={(id, amountG) => {
              try {
                editRecord(id, { amountG });
              } catch (e) {
                setError(e instanceof Error ? e.message : "修改失败");
              }
            }}
            onDelete={(record) => {
              if (confirm(`删除「${record.foodNameSnapshot}」这条记录？`)) removeRecord(record.id);
            }}
          />
        </div>
      </div>
    </div>
  );
}
